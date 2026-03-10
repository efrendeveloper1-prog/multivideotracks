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

const EditorContent: React.FC = () => {
    const {
        setVideoElement, tracks, currentTime, duration, seek,
        videoDuration, trimVideoToAudio, videoOffset, setVideoOffset,
        cutRegions, addCutRegion, removeCutRegion, revertVideo, isInCutRegion
    } = useAudioEngine();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isDraggingOffset, setIsDraggingOffset] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartOffsetRef = useRef<number>(0);

    // Edit mode state
    const [editMode, setEditMode] = useState(false);
    // Split points: sorted array of timestamps (seconds) that divide the timeline into segments
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    // Which segment is currently selected (index into the array of gaps between boundaries)
    const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

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
                </div>

                <div className="bg-gray-800 px-3 py-0.5 rounded text-green-500 font-mono font-bold text-xs sm:text-sm">
                    {fmt(currentTime)} / {fmt(duration)}
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Revert button — only visible in edit mode */}
                    {editMode && hasVideo && (
                        <button
                            onClick={() => {
                                revertVideo();
                                setSplitPoints([]);
                                setSelectedSegmentIndex(null);
                            }}
                            title="Volver al original (borrar todos los cortes)"
                            className="flex items-center gap-1 bg-amber-700 hover:bg-amber-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-white transition-colors"
                        >
                            <span>↺</span>
                            <span className="hidden sm:inline">Revert</span>
                        </button>
                    )}
                    {/* EDIT button */}
                    <button
                        onClick={() => {
                            if (!hasVideo) return;
                            setEditMode(prev => !prev);
                            setSelectedSegmentIndex(null);
                            setSplitPoints([]);
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
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative min-h-0">

                {/* Left: Timeline & Mixer */}
                <div className="flex-1 bg-gray-800/50 p-1 sm:p-2 relative z-10 flex flex-col min-w-0 min-h-0">

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
                        className={`bg-gray-900 mb-1 sm:mb-2 rounded border overflow-hidden flex flex-col relative shrink-0 select-none
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

                        {/* Video Tracks Container */}
                        {videoTrack && (
                            <div className="border-b border-gray-700 relative flex flex-col shrink-0 overflow-hidden"
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
                                    className="flex flex-col relative w-full"
                                    style={{
                                        transform: duration > 0 ? `translateX(${(-videoOffset / duration) * 100}%)` : 'none',
                                    }}
                                >
                                    {/* Thumbnails */}
                                    <div className="h-14 sm:h-20 relative w-full shrink-0">
                                        <VideoTimelineTrack videoFile={videoTrack.file} duration={duration} height={80} />
                                        <div className="absolute top-1 left-1 z-10 bg-purple-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-purple-300 font-bold pointer-events-none">
                                            VIDEO
                                        </div>
                                    </div>

                                    {/* Extracted Audio Waveform */}
                                    {videoAudioTrack && videoAudioTrack.buffer && (
                                        <div className="h-14 sm:h-20 relative w-full shrink-0 border-t border-gray-800 bg-gray-950">
                                            <WaveformDisplay buffer={videoAudioTrack.buffer} color={videoAudioTrack.color} height={80} />
                                            <div className="absolute top-1 left-1 z-10 bg-purple-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-purple-300 font-bold pointer-events-none">
                                                VIDEO AUDIO
                                            </div>
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
                            </div>
                        )}

                        {/* Master Waveform */}
                        <div className="h-20 sm:h-28 relative shrink-0">
                            <div className="w-full relative h-full bg-gray-950">
                                {masterBuffer ? (
                                    <WaveformDisplay buffer={masterBuffer} color="#4ade80" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] sm:text-xs">
                                        No audio loaded
                                    </div>
                                )}
                                <div className="absolute top-1 left-1 z-10 bg-gray-800/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-green-400 font-bold pointer-events-none">
                                    MASTER
                                </div>
                            </div>
                        </div>

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

                        {/* Split-point lines */}
                        {editMode && duration > 0 && splitPoints.map((pt, i) => (
                            <div
                                key={`split-${i}`}
                                className="absolute top-0 bottom-0 z-25 w-0.5 bg-yellow-400/90 pointer-events-none"
                                style={{ left: `${(pt / duration) * 100}%` }}
                                title={`Punto de corte: ${fmt(pt)}`}
                            />
                        ))}

                        {/* Playhead Cursor */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>

                    {/* Mixer Channels */}
                    <div className="flex-1 overflow-hidden border-t border-gray-700 pt-1 sm:pt-2 text-white min-h-0">
                        <MixerBoard />
                    </div>
                </div>

                {/* Right: Sidebar */}
                <div className="w-full sm:w-64 lg:w-72 bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800 flex flex-col z-20 shadow-xl shrink-0 max-h-[40vh] sm:max-h-none">
                    {/* Video Player Preview */}
                    <div className="aspect-video max-h-32 sm:max-h-none bg-black border-b border-gray-800 relative group shrink-0">
                        {videoSrc ? (
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                className="w-full h-full object-contain"
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
                        <div className="absolute top-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] text-gray-400">Preview</div>

                        {/* Audio Meter Overlay */}
                        <div className="absolute top-1 left-2 bottom-1 z-10 flex flex-col items-center justify-end pb-1 pointer-events-none opacity-80">
                            <AudioMeter />
                            <div className="flex gap-1.5 text-[6px] text-gray-400 font-bold mt-1">
                                <span>L</span><span>R</span>
                            </div>
                        </div>
                    </div>

                    {/* Second Screen Button */}
                    <div className="px-2 py-1 border-b border-gray-800 shrink-0">
                        <SecondScreen />
                    </div>

                    {/* Song List (fills remaining) */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <SongList />
                    </div>
                </div>
            </div>

            {/* Footer: Transport Controls */}
            <div className="h-20 sm:h-28 bg-gray-900 border-t border-gray-800 p-1 sm:p-2 z-30 shrink-0">
                <TransportControls />
            </div>
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
