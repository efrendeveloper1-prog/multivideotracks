'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { SecondScreen } from './SecondScreen';
import { AudioMeter } from './AudioMeter';
import { MixerBoard } from './MixerBoard';
import { TransportControls } from './TransportControls';
import { SongList } from './SongList';
import { AudioEngineProvider, useAudioEngine } from '@/hooks/useAudioEngine';
import { WaveformDisplay } from './WaveformDisplay';
import { VideoTimelineTrack } from './VideoTimelineTrack';
import { LyricsEditor } from './LyricsEditor';
import { LyricsTimelineTrack } from './LyricsTimelineTrack';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { LyricsRenderer } from './LyricsRenderer';

const DividerHandle: React.FC<{ orientation: 'horizontal' | 'vertical' }> = ({ orientation }) => {
    return (
        <Separator
            className={`flex items-center justify-center transition-colors bg-gray-800 hover:bg-blue-600/50 group ${
                orientation === 'horizontal' ? 'w-1.5 cursor-col-resize z-50' : 'h-1.5 cursor-row-resize z-50'
            }`}
        >
            <div className={orientation === 'horizontal' ? 'w-px h-8 bg-gray-600 group-hover:bg-blue-400' : 'h-px w-8 bg-gray-600 group-hover:bg-blue-400'} />
        </Separator>
    );
};

const EditorContent: React.FC = () => {
    const {
        setVideoElement, tracks, currentTime, duration, seek, lyrics, lyricsSettings,
        videoDuration, trimVideoToAudio, videoOffset, setVideoOffset,
        videoEndTime, setVideoEndTime,
        videoFadeIn, setVideoFadeIn,
        videoFadeOut, setVideoFadeOut,
        videoOpacity,
        cutRegions, setCutRegions, splitPoints, setSplitPoints,
        sections, setSections,
        addCutRegion, removeCutRegion, revertVideo, isInCutRegion,
        invertBackground, showLyrics, setShowLyrics, panelSizes, setPanelSizes, layoutVersion
    } = useAudioEngine();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isDraggingOffset, setIsDraggingOffset] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartOffsetRef = useRef<number>(0);

    // Edit mode state
    const [editMode, setEditMode] = useState(false);
    const [editingSection, setEditingSection] = useState<{ id?: string, start: number, end: number, color: string, label: string, loopMode: 'none' | 'infinite' | 'custom', loopCount: number } | null>(null);
    // Which segment is currently selected (index into the array of gaps between boundaries)
    const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
    const [draggingBoundary, setDraggingBoundary] = useState<{ index: number, startX: number, initialTime: number, initialCutRegions: typeof cutRegions } | null>(null);
    const [draggingSection, setDraggingSection] = useState<{ id: string, startX: number, initialStart: number, initialEnd: number, type: 'move' | 'resize-left' | 'resize-right' } | null>(null);
    const [resizingVideo, setResizingVideo] = useState<{ startX: number, initialEndTime: number } | null>(null);
    const [resizingFade, setResizingFade] = useState<{ type: 'in' | 'out', startX: number, initialValue: number } | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const [showLyricsEditor, setShowLyricsEditor] = useState(false);

    const activeLyricBlock = useMemo(() => {
        const mostRecentBlock = lyrics
            .filter(l => l.startTime !== null && l.startTime <= currentTime)
            .sort((a, b) => b.startTime! - a.startTime!)[0];
            
        if (mostRecentBlock && mostRecentBlock.endTime && mostRecentBlock.endTime < currentTime) {
            return undefined;
        }
        return mostRecentBlock;
    }, [lyrics, currentTime]);
    const activeLyricText = activeLyricBlock ? activeLyricBlock.text : null;

    const hasLyrics = lyrics.length > 0;
    const videoTrackInfo = tracks.find(t => t.name === "VIDEO TRACK");
    const hasVideoTrack = !!videoTrackInfo;
    const tlPanelsCount = (hasLyrics ? 1 : 0) + (hasVideoTrack ? 1 : 0) + 1;
    
    const safeTlSizes = panelSizes.timeline;

    useEffect(() => {
        if (videoRef.current) {
            setVideoElement(videoRef.current);
        }
    }, [setVideoElement]);

    const videoTrack = tracks.find(t => t.name === "VIDEO TRACK");
    const videoAudioTrack = tracks.find(t => t.isVideoAudio);
    const hasVideo = !!videoTrack;

    // Reset edit mode when video is removed
    useEffect(() => {
        if (!hasVideo) {
            setEditMode(false);
            setSelectedSegmentIndex(null);
            setSplitPoints([]);
        }
    }, [hasVideo]);

    // Connect video source instantly when video track changes
    useEffect(() => {
        if (videoTrack && videoTrack.file) {
            const url = URL.createObjectURL(videoTrack.file);
            setVideoSrc(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        } else {
            setVideoSrc(null);
        }
    }, [videoTrack]);

    // --- Segment helpers ---

    /**
     * Compute the list of segment boundaries from split points.
     * Boundaries are: [0, ...splitPoints, duration] (sorted).
     * Each segment i spans from boundaries[i] to boundaries[i+1].
     */
    const segmentBoundaries = useMemo(() => {
        if (duration <= 0) return [0, duration];
        return [0, ...splitPoints, duration];
    }, [splitPoints, duration]);

    /**
     * For each segment, determine whether it is a "cut" segment
     * (i.e. it overlaps with at least one committed cutRegion).
     */
    const segmentCutStatus = useMemo(() => {
        return segmentBoundaries.slice(0, -1).map((start, i) => {
            const end = segmentBoundaries[i + 1];
            // A segment is "cut" if there exists a cutRegion that fully covers it
            // (within a small tolerance)
            return cutRegions.some(
                r => r.start <= start + 0.05 && r.end >= end - 0.05
            );
        });
    }, [segmentBoundaries, cutRegions]);

    /**
     * Find the cutRegion index that corresponds to a segment.
     */
    const findCutRegionForSegment = useCallback((segIdx: number) => {
        const start = segmentBoundaries[segIdx];
        const end = segmentBoundaries[segIdx + 1];
        return cutRegions.findIndex(
            r => r.start <= start + 0.05 && r.end >= end - 0.05
        );
    }, [segmentBoundaries, cutRegions]);

    // Handle dragging split points (edges of clips)
    useEffect(() => {
        if (draggingBoundary === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineRef.current || duration <= 0) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const deltaX = e.clientX - draggingBoundary.startX;
            const deltaTime = (deltaX / rect.width) * duration;
            
            let newTime = draggingBoundary.initialTime + deltaTime;
            
            setSplitPoints(prev => {
                const minTime = draggingBoundary.index === 0 ? 0 : prev[draggingBoundary.index - 1] + 0.1;
                const maxTime = draggingBoundary.index === prev.length - 1 ? duration : prev[draggingBoundary.index + 1] - 0.1;
                newTime = Math.max(minTime, Math.min(newTime, maxTime));

                const arr = [...prev];
                arr[draggingBoundary.index] = newTime;
                return arr.sort((a,b) => a-b);
            });

            // Reconstruct new cut regions from initial ones safely
            const updatedCuts = draggingBoundary.initialCutRegions.map(cr => {
                let ns = cr.start;
                let ne = cr.end;
                if (Math.abs(ns - draggingBoundary.initialTime) < 0.05) ns = newTime;
                if (Math.abs(ne - draggingBoundary.initialTime) < 0.05) ne = newTime;
                return { start: Math.min(ns, ne), end: Math.max(ns, ne) };
            });
            setCutRegions(updatedCuts);
        };

        const handleMouseUp = () => {
            setDraggingBoundary(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingBoundary, duration, setCutRegions]);
    
    // Handle fade resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingFade && timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const pixelsPerSecond = rect.width / duration;
                const deltaX = e.clientX - resizingFade.startX;
                const deltaSeconds = deltaX / pixelsPerSecond;

                if (resizingFade.type === 'in') {
                    const newValue = Math.max(0, resizingFade.initialValue + deltaSeconds);
                    // Fade in cannot exceed half the block duration or some limit
                    const maxFade = (videoEndTime - Math.max(0, -videoOffset)) * 0.5;
                    setVideoFadeIn(Math.min(newValue, maxFade));
                } else {
                    const newValue = Math.max(0, resizingFade.initialValue - deltaSeconds);
                    const maxFade = (videoEndTime - Math.max(0, -videoOffset)) * 0.5;
                    setVideoFadeOut(Math.min(newValue, maxFade));
                }
            }
        };

        const handleMouseUp = () => {
            setResizingFade(null);
        };

        if (resizingFade) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingFade, duration, videoEndTime, videoOffset, setVideoFadeIn, setVideoFadeOut]);

    // Handle section dragging/resizing
    useEffect(() => {
        if (!draggingSection) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineRef.current || duration <= 0) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const deltaX = e.clientX - draggingSection.startX;
            const deltaTime = (deltaX / rect.width) * duration;
            
            setSections(prev => prev.map(s => {
                if (s.id !== draggingSection.id) return s;
                let newStart = draggingSection.initialStart;
                let newEnd = draggingSection.initialEnd;
                
                if (draggingSection.type === 'move') {
                    newStart = Math.max(0, draggingSection.initialStart + deltaTime);
                    const dur = draggingSection.initialEnd - draggingSection.initialStart;
                    newEnd = newStart + dur;
                    if (newEnd > duration) {
                        newEnd = duration;
                        newStart = duration - dur;
                    }
                } else if (draggingSection.type === 'resize-left') {
                    newStart = Math.max(0, Math.min(draggingSection.initialStart + deltaTime, s.end - 0.1));
                } else if (draggingSection.type === 'resize-right') {
                    newEnd = Math.min(duration, Math.max(s.start + 0.1, draggingSection.initialEnd + deltaTime));
                }
                return { ...s, start: newStart, end: newEnd };
            }));
        };

        const handleMouseUp = () => {
            setDraggingSection(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingSection, duration, setSections]);

    // Handle video track edge resizing
    useEffect(() => {
        if (resizingVideo === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineRef.current || duration <= 0) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const deltaX = e.clientX - resizingVideo.startX;
            const deltaTime = (deltaX / rect.width) * duration;
            
            let newEndTime = resizingVideo.initialEndTime + deltaTime;
            // Constrain: at least 0.1s long (taking offset into account if needed, but let's keep it simple)
            const minEndTime = Math.max(0.1, -videoOffset + 0.1);
            newEndTime = Math.max(minEndTime, Math.min(newEndTime, duration));
            
            setVideoEndTime(newEndTime);
        };

        const handleMouseUp = () => {
            setResizingVideo(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingVideo, duration, videoOffset, setVideoEndTime]);

    // --- Keyboard handler ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (!editMode) return;

            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                if (duration <= 0) return;
                const t = currentTime;

                setSplitPoints(prev => {
                    // Guard: don't add if already very close to an existing point or boundary
                    const tooClose = prev.some(p => Math.abs(p - t) < 0.15) ||
                        t < 0.15 || t > duration - 0.15;
                    if (tooClose) return prev;
                    return [...prev, t].sort((a, b) => a - b);
                });
                setSelectedSegmentIndex(null);
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (selectedSegmentIndex === null) return;

                const isCut = segmentCutStatus[selectedSegmentIndex];
                if (isCut) {
                    // Restore: remove the corresponding cutRegion
                    const crIdx = findCutRegionForSegment(selectedSegmentIndex);
                    if (crIdx !== -1) {
                        removeCutRegion(crIdx);
                    }
                } else {
                    // Mark as cut: add a cutRegion spanning this segment
                    const start = segmentBoundaries[selectedSegmentIndex];
                    const end = segmentBoundaries[selectedSegmentIndex + 1];
                    addCutRegion({ start, end });
                }
                setSelectedSegmentIndex(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        editMode, duration, currentTime, selectedSegmentIndex,
        segmentCutStatus, segmentBoundaries, findCutRegionForSegment,
        addCutRegion, removeCutRegion
    ]);

    // Create a master (mixed) AudioBuffer from all audio tracks
    const masterBuffer = useMemo(() => {
        const audioTracks = tracks.filter(t => t.buffer && !t.name.includes("VIDEO"));
        if (audioTracks.length === 0) return null;

        const maxLength = Math.max(...audioTracks.map(t => t.buffer!.length));
        const sampleRate = audioTracks[0].buffer!.sampleRate;
        const mixed = new Float32Array(maxLength);

        audioTracks.forEach(track => {
            const data = track.buffer!.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                mixed[i] += data[i];
            }
        });

        let peak = 0;
        for (let i = 0; i < mixed.length; i++) {
            const abs = Math.abs(mixed[i]);
            if (abs > peak) peak = abs;
        }
        if (peak > 1) {
            for (let i = 0; i < mixed.length; i++) {
                mixed[i] /= peak;
            }
        }

        const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = ac.createBuffer(1, maxLength, sampleRate);
        buf.copyToChannel(mixed, 0);
        ac.close();

        return buf;
    }, [tracks]);

    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Timeline click: seek in normal mode, select segment in edit mode
    const getTimeFromClientX = useCallback((clientX: number) => {
        if (!timelineRef.current || duration <= 0) return null;
        const rect = timelineRef.current.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        return ratio * duration;
    }, [duration]);

    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (!editMode) {
            const t = getTimeFromClientX(e.clientX);
            if (t !== null) seek(t);
            return;
        }
        // In edit mode: determine which segment was clicked and select it
        if (duration <= 0) return;
        const t = getTimeFromClientX(e.clientX);
        if (t === null) return;
        const segIdx = segmentBoundaries.findIndex((b, i) =>
            i < segmentBoundaries.length - 1 && t >= b && t < segmentBoundaries[i + 1]
        );
        if (segIdx !== -1) {
            setSelectedSegmentIndex(prev => prev === segIdx ? null : segIdx);
        }
    }, [editMode, duration, getTimeFromClientX, seek, segmentBoundaries]);

    return (
        <div className="flex flex-col h-screen h-[100dvh] bg-black text-white overflow-hidden font-sans">
            {/* Header */}
            <div className="h-10 sm:h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-2 sm:px-4 shrink-0">
                <div className="flex items-center gap-1 sm:gap-3">
                    <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-gray-300">SETLIST</button>
                    <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-gray-300">MIDI</button>
                    <button 
                        onClick={() => setShowLyricsEditor(true)}
                        className={`${showLyricsEditor ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'} px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors`}
                    >
                        LYRICS
                    </button>
                </div>

                <div className="bg-gray-800 px-3 py-0.5 rounded text-green-500 font-mono font-bold text-xs sm:text-sm">
                    {fmt(currentTime)} / {fmt(duration)}
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Revert button — only visible in edit mode */}
                    {editMode && hasVideo && (
                        <>
                            <button
                                onClick={() => {
                                    if (duration <= 0) return;
                                    const t = currentTime;
                                    setSplitPoints(prev => {
                                        const tooClose = prev.some(p => Math.abs(p - t) < 0.15) || t < 0.15 || t > duration - 0.15;
                                        if (tooClose) return prev;
                                        return [...prev, t].sort((a, b) => a - b);
                                    });
                                    setSelectedSegmentIndex(null);
                                }}
                                title="Dividir en Playhead (S)"
                                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-white transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 4H7v16h3V4zm7 0h-3v16h3V4z"/>
                                    <path d="M4 12l4-4v8zM20 12l-4-4v8z"/>
                                </svg>
                                <span className="hidden sm:inline">Split</span>
                            </button>
                            <button
                                onClick={() => {
                                    revertVideo();
                                    setSelectedSegmentIndex(null);
                                }}
                                title="Volver al original (borrar todos los cortes)"
                                className="flex items-center gap-1 bg-amber-700 hover:bg-amber-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-white transition-colors"
                            >
                                <span>↺</span>
                                <span className="hidden sm:inline">Revert</span>
                            </button>
                        </>
                    )}
                    {/* EDIT button */}
                    <button
                        onClick={() => {
                            if (!hasVideo) return;
                            setEditMode(prev => !prev);
                            setSelectedSegmentIndex(null);
                        }}
                        disabled={!hasVideo}
                        title={hasVideo ? (editMode ? 'Salir del modo edición' : 'Entrar en modo edición') : 'Carga un video para editar'}
                        className={`
                            px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-all duration-200
                            ${!hasVideo
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50'
                                : editMode
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }
                        `}
                    >
                        {editMode ? '✂ EDIT ON' : 'EDIT'}
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                <Group 
                    key={`main-${layoutVersion}`} 
                    orientation="horizontal" 
                    onLayoutChanged={(sizes) => setPanelSizes(prev => ({ ...prev, main: sizes }))}
                    defaultLayout={panelSizes.main}
                >
                    <Panel id="main-left" minSize={20} className="flex flex-col min-w-0 min-h-0 relative z-10">
                        <Group 
                            key={`left-${layoutVersion}`} 
                            orientation="vertical" 
                            onLayoutChanged={(sizes) => setPanelSizes(prev => ({ ...prev, left: sizes }))}
                            defaultLayout={panelSizes.left}
                        >
                            <Panel id="left-top" minSize={10} className="flex flex-col min-h-0 bg-gray-800/50 p-1 sm:p-2 relative z-10 transition-colors">

                    {/* Edit mode instructions */}
                    {editMode && (
                        <div className="flex items-center gap-2 px-2 py-1 mb-1 bg-blue-900/40 border border-blue-700/50 rounded text-blue-300 text-[10px] sm:text-xs shrink-0">
                            <span>✂</span>
                            <span>
                                Pulsa <kbd className="bg-blue-800 px-1 rounded">S</kbd> para dividir en la posición del playhead.&nbsp;
                                Haz clic en un segmento para seleccionarlo.&nbsp;
                                Pulsa <kbd className="bg-blue-800 px-1 rounded">Supr</kbd> para eliminar / restaurar el segmento seleccionado.
                            </span>
                        </div>
                    )}

                    {/* Timeline Area */}
                    <div
                        ref={timelineRef}
                        className={`bg-gray-900 mb-1 sm:mb-2 rounded border flex flex-col relative shrink-0 select-none h-full min-h-0 overflow-hidden
                            ${editMode
                                ? 'border-blue-700 cursor-pointer'
                                : 'border-gray-700 cursor-crosshair'
                            }`}
                        onClick={handleTimelineClick}
                    >

                        {/* Trim Video Warning */}
                        {videoTrack && videoDuration > 0 && duration > 0 && videoDuration > duration + 0.5 && (
                            <div className="flex items-center justify-between px-2 py-1 bg-amber-900/40 border-b border-amber-700/50 text-amber-300 text-[10px] shrink-0">
                                <span>⚠ Video ({Math.floor(videoDuration)}s) es más largo que el audio ({Math.floor(duration)}s)</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); trimVideoToAudio(); }}
                                    className="px-2 py-0.5 bg-amber-700 hover:bg-amber-600 rounded text-white text-[10px] font-bold ml-2"
                                >
                                    Ajustar
                                </button>
                            </div>
                        )}

                        <Group 
                            key={`tl-${layoutVersion}-${tlPanelsCount}`}
                            orientation="vertical" 
                            className="flex-1 w-full"
                            onLayoutChanged={(sizes) => setPanelSizes(prev => ({ ...prev, timeline: sizes }))}
                            defaultLayout={panelSizes.timeline}
                        >
                            {/* Lyrics Panel */}
                            {hasLyrics && (
                                <>
                                    <Panel id="tl-lyrics" minSize={10} className="relative flex flex-col shrink-0 min-h-[40px]">
                                        <LyricsTimelineTrack />
                                    </Panel>
                                    <DividerHandle orientation="vertical" />
                                </>
                            )}

                            {/* Video Tracks Container */}
                            {videoTrack && (
                                <>
                                    <Panel id="tl-video" minSize={15} 
                                        className="relative flex flex-col shrink-0 overflow-hidden"
                                        onMouseDown={(e) => {
                                            if (editMode) return;
                                            e.stopPropagation();
                                            setIsDraggingOffset(true);
                                            dragStartXRef.current = e.clientX;
                                            dragStartOffsetRef.current = videoOffset;
                                        }}
                                        onMouseMove={(e) => {
                                            if (editMode) return;
                                            if (!isDraggingOffset) return;
                                            const deltaX = e.clientX - dragStartXRef.current;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const secondsPerPixel = duration / rect.width;
                                            setVideoOffset(dragStartOffsetRef.current - deltaX * secondsPerPixel);
                                        }}
                                        onMouseUp={() => setIsDraggingOffset(false)}
                                        onMouseLeave={() => setIsDraggingOffset(false)}
                                        style={{ cursor: editMode ? 'pointer' : isDraggingOffset ? 'grabbing' : 'grab' }}
                                    >
                                        <div
                                            className="flex flex-col relative h-full overflow-hidden transition-all duration-75"
                                            style={{
                                                left: `${(Math.max(0, -videoOffset) / duration) * 100}%`,
                                                width: `${((videoEndTime - Math.max(0, -videoOffset)) / duration) * 100}%`,
                                                minWidth: "20px"
                                            }}
                                        >
                                            {/* Translate for the actual frames inside the visible clip */}
                                            <div 
                                               className="absolute top-0 bottom-0 flex flex-col overflow-hidden"
                                               style={{
                                                   transform: videoDuration > 0 ? `translateX(${( -Math.max(0, videoOffset) / videoDuration ) * 100}%)` : "none",
                                                   width: `${(videoDuration / (videoEndTime - Math.max(0, -videoOffset))) * 100}%`
                                               }}
                                            >
                                               <div className="flex-1 flex flex-col relative w-full min-h-0 shrink-0">
                                                   {/* Video Thumbnails Track */}
                                                   <div className="flex-1 relative w-full min-h-0 shrink-0">
                                                       <VideoTimelineTrack videoFile={videoTrack.file} duration={videoDuration} height={100} />
                                                       <div className="absolute top-1 left-1 z-10 bg-purple-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-purple-300 font-bold pointer-events-none">
                                                           VIDEO
                                                       </div>
                                                   </div>
                                                   
                                                   {/* Extracted Audio Waveform Track */}
                                                   {videoAudioTrack && (
                                                       <div className="flex-1 relative w-full min-h-0 shrink-0 border-t border-gray-800 bg-gray-950">
                                                           {videoAudioTrack.buffer ? (
                                                               <>
                                                                   <WaveformDisplay buffer={videoAudioTrack.buffer} color={videoAudioTrack.color} height={100} />
                                                                   <div className="absolute top-1 left-1 z-10 bg-purple-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-purple-300 font-bold pointer-events-none">
                                                                       VIDEO AUDIO {videoAudioTrack.muted ? '(MUTED)' : ''}
                                                                   </div>
                                                               </>
                                                           ) : (
                                                               <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 italic">
                                                                   Cargando audio del video...
                                                               </div>
                                                           )}
                                                       </div>
                                                   )}
                                               </div>
                                            </div>

                                            {/* Fade Overlays (SVG) */}
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                                                {videoFadeIn > 0 && (
                                                    <path 
                                                        d={`M 0 0 L ${(videoFadeIn / Math.max(0.1, videoEndTime - Math.max(0, -videoOffset))) * 100} 0 L 0 100 Z`} 
                                                        className="fill-white/20" 
                                                        vectorEffect="non-scaling-stroke"
                                                        preserveAspectRatio="none"
                                                    />
                                                )}
                                                {videoFadeOut > 0 && (
                                                    <path 
                                                        d={`M 100 0 L ${100 - (videoFadeOut / Math.max(0.1, videoEndTime - Math.max(0, -videoOffset))) * 100} 0 L 100 100 Z`} 
                                                        className="fill-white/20" 
                                                        vectorEffect="non-scaling-stroke"
                                                        preserveAspectRatio="none"
                                                    />
                                                )}
                                            </svg>

                                            {/* Fade Handles (Vegas Style) */}
                                            {!editMode && (
                                                <>
                                                    {/* Fade In (Top Left) */}
                                                    <div 
                                                        className="absolute top-0 left-0 w-4 h-4 cursor-ew-resize z-30 group"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setResizingFade({ type: "in", startX: e.clientX, initialValue: videoFadeIn });
                                                        }}
                                                    >
                                                        <div className="absolute top-0 left-0 w-full h-full text-white/50 group-hover:text-white transition-colors">
                                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M4 4 Q 4 20 20 20 L 20 4 Z" opacity="0.3" />
                                                                <path d="M4 4 Q 4 20 20 20" fill="none" stroke="currentColor" strokeWidth="2" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    {/* Fade Out (Top Right) */}
                                                    <div 
                                                        className="absolute top-0 right-0 w-4 h-4 cursor-ew-resize z-30 group"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setResizingFade({ type: "out", startX: e.clientX, initialValue: videoFadeOut });
                                                        }}
                                                    >
                                                        <div className="absolute top-0 right-0 w-full h-full text-white/50 group-hover:text-white transition-colors">
                                                            <svg viewBox="0 0 24 24" fill="currentColor" transform="scale(-1, 1)">
                                                                <path d="M4 4 Q 4 20 20 20 L 20 4 Z" opacity="0.3" />
                                                                <path d="M4 4 Q 4 20 20 20" fill="none" stroke="currentColor" strokeWidth="2" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {!editMode && (
                                                <div 
                                                    className="absolute inset-y-0 right-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-40 group"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setResizingVideo({
                                                            startX: e.clientX,
                                                            initialEndTime: videoEndTime
                                                        });
                                                    }}
                                                >
                                                    <div className="absolute inset-y-0 right-0 w-0.5 bg-purple-400 opacity-50 group-hover:opacity-100"></div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Offset badge */}
                                        {videoOffset !== 0 && (
                                            <div className="absolute top-1 right-1 z-10 bg-amber-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] text-amber-300 font-mono pointer-events-none">
                                                {videoOffset > 0 ? '+' : ''}{videoOffset.toFixed(1)}s
                                            </div>
                                        )}
                                        {/* Reset offset button */}
                                        {videoOffset !== 0 && !editMode && (
                                            <button
                                                className="absolute bottom-1 right-1 z-10 bg-gray-700/80 hover:bg-gray-600 px-1 py-0.5 rounded text-[7px] text-gray-300"
                                                onClick={(e) => { e.stopPropagation(); setVideoOffset(0); }}
                                                title="Reset offset"
                                            >
                                                ↺ Reset
                                            </button>
                                        )}
                                    </Panel>
                                    <DividerHandle orientation="vertical" />
                                </>
                            )}

                            {/* Master Waveform */}
                            <Panel id="tl-master" minSize={15} className="relative flex flex-col shrink-0 min-h-[40px] overflow-hidden bg-gray-950">
                                {/* FULL HEIGHT SECTION BACKGROUNDS */}
                                <div className="absolute inset-0 z-[15] pointer-events-none">
                                    {duration > 0 && sections.map(s => (
                                        <div key={`bg-${s.id}`} 
                                             className="absolute top-0 bottom-0 opacity-60 transition-all pointer-events-none"
                                             style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, backgroundColor: s.color }}
                                        />
                                    ))}
                                </div>

                                {/* SECTION MARKERS */}
                                <div className="w-full relative h-5 bg-gray-900/50 border-b border-gray-800 shrink-0 cursor-crosshair group z-20"
                                     onDoubleClick={(e) => {
                                        if (duration <= 0) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const t = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * duration;
                                        setEditingSection({ start: t, end: Math.min(t + 4, duration), color: '#3b82f6', label: 'V1', loopMode: 'none', loopCount: 0 });
                                     }}
                                     title="Doble clic para añadir sección de bucle"
                                >
                                    {duration > 0 && sections.map(s => (
                                        <div key={s.id}
                                             className="absolute top-0 bottom-0 border-r border-black/50 text-[10px] font-bold text-black flex items-center justify-center overflow-hidden whitespace-nowrap shadow-sm transition-all group/sec"
                                             style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, backgroundColor: s.color }}
                                             title={`${s.label} (${s.loopMode !== 'none' ? (s.loopMode === 'infinite' ? '∞' : `vueltas: ${s.loopCount}`) : 'Sin bucle'}) - Doble clic editar, arrastrar bordes/centro`}
                                             onDoubleClick={(e) => { e.stopPropagation(); setEditingSection(s); }}
                                             onMouseDown={(e) => {
                                                 e.stopPropagation();
                                                 setDraggingSection({ id: s.id, startX: e.clientX, initialStart: s.start, initialEnd: s.end, type: 'move' });
                                             }}
                                        >
                                            {/* Left Resize Handle */}
                                            <div 
                                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-10"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setDraggingSection({ id: s.id, startX: e.clientX, initialStart: s.start, initialEnd: s.end, type: 'resize-left' });
                                                }}
                                            />

                                            <div className="flex-1 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing">
                                                <span className="bg-black/20 px-1 rounded-sm backdrop-blur-sm text-white/90 drop-shadow-md pointer-events-none">
                                                    {s.label} {s.loopMode !== 'none' && <span className="text-[8px] ml-0.5 opacity-80">🔄</span>}
                                                </span>
                                            </div>

                                            {/* Right Resize Handle */}
                                            <div 
                                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-10"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setDraggingSection({ id: s.id, startX: e.clientX, initialStart: s.start, initialEnd: s.end, type: 'resize-right' });
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="w-full relative h-full flex-1 z-10 pointer-events-none">
                                    {masterBuffer ? (
                                        <div className="absolute inset-0 z-10">
                                            <WaveformDisplay buffer={masterBuffer} color="#00e5ff" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] sm:text-xs">
                                            No audio loaded
                                        </div>
                                    )}
                                    <div className="absolute top-1 left-1 z-20 bg-gray-800/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-white font-bold pointer-events-none">
                                        MASTER
                                    </div>
                                </div>
                            </Panel>
                        </Group>

                        {/* ── Overlays (all absolute, full-height of timeline container) ── */}

                        {/* Segment overlays in edit mode */}
                        {editMode && duration > 0 && segmentBoundaries.slice(0, -1).map((start, i) => {
                            const end = segmentBoundaries[i + 1];
                            const isCut = segmentCutStatus[i];
                            const isSelected = selectedSegmentIndex === i;
                            const leftPct = (start / duration) * 100;
                            const widthPct = ((end - start) / duration) * 100;

                            return (
                                <div
                                    key={i}
                                    className={`absolute top-0 bottom-0 z-20 transition-all duration-100 cursor-pointer
                                        ${isCut
                                            ? isSelected
                                                ? 'bg-red-500/50 border-2 border-red-400'
                                                : 'bg-red-900/40 border border-red-700/60 hover:bg-red-800/50'
                                            : isSelected
                                                ? 'bg-blue-500/25 border-2 border-blue-400'
                                                : 'bg-transparent border border-transparent hover:bg-white/5 hover:border-blue-700/40'
                                        }`}
                                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSegmentIndex(prev => prev === i ? null : i);
                                    }}
                                    title={isCut
                                        ? `Segmento eliminado: ${fmt(start)}–${fmt(end)}. Selecciona y pulsa Supr para restaurar.`
                                        : `Segmento: ${fmt(start)}–${fmt(end)}. Selecciona y pulsa Supr para eliminar.`
                                    }
                                >
                                    {/* Label on selected */}
                                    {isSelected && (
                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded text-[8px] whitespace-nowrap z-30 pointer-events-none text-white"
                                            style={{ background: isCut ? '#b91c1c' : '#1d4ed8' }}
                                        >
                                            {isCut ? '✂ Supr para restaurar' : 'Supr para eliminar'}
                                        </div>
                                    )}
                                    {/* Scissors icon for cut segments */}
                                    {isCut && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-red-300 text-[10px] opacity-75 select-none">✂</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Split-point lines (draggable handles) */}
                        {editMode && duration > 0 && splitPoints.map((pt, i) => (
                            <div
                                key={`split-${i}`}
                                className="absolute top-0 bottom-0 z-40 flex items-center justify-center cursor-ew-resize group"
                                style={{ left: `calc(${(pt / duration) * 100}% - 8px)`, width: '16px' }}
                                title={`Arrastra para ajustar: ${fmt(pt)}`}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setDraggingBoundary({
                                        index: i,
                                        startX: e.clientX,
                                        initialTime: splitPoints[i],
                                        initialCutRegions: cutRegions
                                    });
                                }}
                            >
                                {/* Visual line: thick on hover, thin normally */}
                                <div className={`h-full transition-all duration-100 ${
                                    draggingBoundary?.index === i 
                                        ? 'w-2 bg-yellow-400' 
                                        : 'w-0.5 bg-yellow-400/90 group-hover:w-2 group-hover:bg-yellow-400'
                                }`} />
                                
                                {/* Inner line for styling akin to drag handles */}
                                <div className="absolute inset-y-0 w-px bg-yellow-600/50 pointer-events-none" />
                            </div>
                        ))}

                        {/* Playhead Cursor */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>
                            </Panel>
                            
                            <DividerHandle orientation="vertical" />

                            {/* Mixer Channels */}
                            <Panel id="left-mixer" minSize={10} className="flex flex-col text-white min-h-0 bg-gray-800/50 pt-1 sm:pt-2 relative z-10 overflow-hidden">
                                <MixerBoard />
                            </Panel>
                        </Group>
                    </Panel>

                    <DividerHandle orientation="horizontal" />

                    {/* Right: Sidebar */}
                    <Panel id="main-right" minSize={15} className="w-full bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800 flex flex-col z-20 shadow-xl shrink-0 max-h-[40vh] sm:max-h-none">
                        <Group 
                            key={`sidebar-${layoutVersion}`} 
                            orientation="vertical" 
                            onLayoutChanged={(sizes) => setPanelSizes(prev => ({ ...prev, sidebar: sizes }))}
                            defaultLayout={panelSizes.sidebar}
                        >
                            {/* Video Player Preview */}
                            <Panel id="sidebar-preview" minSize={10} className="flex flex-col relative shrink-0">
                                <div className={`flex-1 ${invertBackground ? 'bg-white' : 'bg-black'} relative group transition-colors duration-500 overflow-hidden`}>
                        {videoSrc ? (
                            <video
                                ref={videoRef}
                                src={videoSrc || undefined}
                                className="w-full h-full object-contain"
                                style={{ opacity: videoOpacity }}
                                muted
                                onTimeUpdate={(e) => {
                                    // Sycn timeline if needed - but usually controlled by loop
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">
                                No Video
                            </div>
                        )}
                        {/* Black overlay during cut gaps */}
                        {isInCutRegion && (
                            <div className="absolute inset-0 bg-black z-20 pointer-events-none" />
                        )}
                        
                        <div className="absolute top-1 right-1 flex gap-1 z-30">
                            <button 
                                onClick={() => setShowLyrics(!showLyrics)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${showLyrics ? 'bg-blue-600 text-white border border-blue-500' : 'bg-gray-800 text-gray-400 border border-gray-700'} transition-colors`}
                                title="Mostrar/Ocultar Letras en Preview"
                            >
                                TXT
                            </button>
                            <div className="bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-gray-400 border border-gray-800">Preview</div>
                        </div>

                        {/* Lyrics Preview Overlay */}
                        {showLyrics && activeLyricText && (
                            <div className={`absolute inset-x-0 flex flex-col z-20 pointer-events-none px-2
                                ${lyricsSettings.position === 'top' ? 'top-6 sm:top-8 justify-start' : 
                                  lyricsSettings.position === 'middle' ? 'inset-y-0 justify-center' : 
                                  'bottom-6 sm:bottom-8 justify-end'}`}
                            >
                                <LyricsRenderer 
                                    text={activeLyricText}
                                    settings={lyricsSettings}
                                    invertBackground={invertBackground}
                                    isExiting={false}
                                    scale={0.25}
                                />
                            </div>
                        )}

                        {/* Audio Meter Overlay */}
                        <div className="absolute top-1 left-2 bottom-1 z-10 flex flex-col items-center justify-end pb-1 pointer-events-none opacity-80">
                            <AudioMeter />
                            <div className="flex gap-1.5 text-[6px] text-gray-400 font-bold mt-1">
                                <span>L</span><span>R</span>
                            </div>
                        </div>
                                </div>
                            </Panel>

                            <DividerHandle orientation="vertical" />

                            <Panel id="sidebar-list" minSize={10} className="flex flex-col min-h-0">
                                {/* Second Screen Button */}
                                <div className="px-2 py-1 border-b border-gray-800 shrink-0">
                                    <SecondScreen />
                                </div>

                                {/* Song List (fills remaining) */}
                                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                    <SongList />
                                </div>
                            </Panel>
                        </Group>
                    </Panel>
                </Group>
            </div>

            {/* Footer: Transport Controls */}
            <div className="h-20 sm:h-28 bg-gray-900 border-t border-gray-800 p-1 sm:p-2 z-30 shrink-0">
                <TransportControls />
            </div>

            {/* Modals */}
            {showLyricsEditor && <LyricsEditor onClose={() => setShowLyricsEditor(false)} />}
            
            {editingSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded shadow-2xl w-80 text-white">
                        <h3 className="text-sm font-bold mb-4">{editingSection.id ? 'Editar Sección' : 'Nueva Sección'}</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Nombre (ej. Verse 1)</label>
                                <input type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={editingSection.label} onChange={e => setEditingSection({...editingSection, label: e.target.value})} />
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">Inicio (s)</label>
                                    <input type="number" step="0.1" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={editingSection.start.toFixed(1)} onChange={e => setEditingSection({...editingSection, start: parseFloat(e.target.value) || 0})} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">Fin (s)</label>
                                    <input type="number" step="0.1" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={editingSection.end.toFixed(1)} onChange={e => setEditingSection({...editingSection, end: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Color</label>
                                <input type="color" className="w-full h-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" value={editingSection.color} onChange={e => setEditingSection({...editingSection, color: e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Modo de Bucle</label>
                                <select className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={editingSection.loopMode} onChange={e => setEditingSection({...editingSection, loopMode: e.target.value as any})}>
                                    <option value="none">Sin Bucle (Continuar)</option>
                                    <option value="infinite">Infinito</option>
                                    <option value="custom">Número específico de veces</option>
                                </select>
                            </div>
                            
                            {editingSection.loopMode === 'custom' && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Cantidad de repeticiones (ej. 2 vueltas extra)</label>
                                    <input type="number" min="1" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={editingSection.loopCount} onChange={e => setEditingSection({...editingSection, loopCount: parseInt(e.target.value) || 1})} />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-5 flex gap-2 justify-end">
                            {editingSection.id && (
                                <button className="bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-1 rounded text-xs font-bold mr-auto transition-colors"
                                    onClick={() => {
                                        setSections(prev => prev.filter(s => s.id !== editingSection.id));
                                        setEditingSection(null);
                                    }}
                                >Eliminar</button>
                            )}
                            <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-bold transition-colors" onClick={() => setEditingSection(null)}>Cancelar</button>
                            <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs font-bold transition-colors"
                                onClick={() => {
                                    if (editingSection.id) {
                                        setSections(prev => prev.map(s => s.id === editingSection.id ? { ...editingSection, id: s.id } as any : s));
                                    } else {
                                        setSections(prev => [...prev, { ...editingSection, id: crypto.randomUUID() } as any]);
                                    }
                                    setEditingSection(null);
                                }}
                            >Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function StudioEditor() {
    return (
        <AudioEngineProvider>
            <EditorContent />
        </AudioEngineProvider>
    );
}
