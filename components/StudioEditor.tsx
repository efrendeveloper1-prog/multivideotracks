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
        cutRegions, addCutRegion, removeCutRegion, revertVideo
    } = useAudioEngine();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isDraggingOffset, setIsDraggingOffset] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartOffsetRef = useRef<number>(0);

    // Edit mode state
    const [editMode, setEditMode] = useState(false);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [selectionStart, setSelectionStart] = useState<number | null>(null); // in seconds
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);     // in seconds
    const [selectedCutIndex, setSelectedCutIndex] = useState<number | null>(null);
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
            setSelectedCutIndex(null);
            setSelectionStart(null);
            setSelectionEnd(null);
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

    // Delete key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Supr') && selectedCutIndex !== null && editMode) {
                removeCutRegion(selectedCutIndex);
                setSelectedCutIndex(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCutIndex, editMode, removeCutRegion]);

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

    // Timeline interaction helpers
    const getTimeFromClientX = useCallback((clientX: number) => {
        if (!timelineRef.current || duration <= 0) return null;
        const rect = timelineRef.current.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        return ratio * duration;
    }, [duration]);

    const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
        if (!editMode) {
            // Normal mode: seek
            const t = getTimeFromClientX(e.clientX);
            if (t !== null) seek(t);
            return;
        }
        // Edit mode: start selection
        const t = getTimeFromClientX(e.clientX);
        if (t === null) return;
        setSelectedCutIndex(null);
        setSelectionStart(t);
        setSelectionEnd(t);
        setIsDraggingSelection(true);
    }, [editMode, getTimeFromClientX, seek]);

    const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingSelection) return;
        const t = getTimeFromClientX(e.clientX);
        if (t === null) return;
        setSelectionEnd(t);
    }, [isDraggingSelection, getTimeFromClientX]);

    const handleTimelineMouseUp = useCallback(() => {
        if (!isDraggingSelection) return;
        setIsDraggingSelection(false);
        if (selectionStart !== null && selectionEnd !== null) {
            const s = Math.min(selectionStart, selectionEnd);
            const e = Math.max(selectionStart, selectionEnd);
            // Only register if the selection has some minimum width (> 0.1s)
            if (e - s > 0.1) {
                addCutRegion({ start: s, end: e });
            }
        }
        setSelectionStart(null);
        setSelectionEnd(null);
    }, [isDraggingSelection, selectionStart, selectionEnd, addCutRegion]);

    // Selection overlay position (as percentage of timeline)
    const selectionOverlay = useMemo(() => {
        if (selectionStart === null || selectionEnd === null || duration <= 0) return null;
        const s = Math.min(selectionStart, selectionEnd);
        const e = Math.max(selectionStart, selectionEnd);
        return {
            left: `${(s / duration) * 100}%`,
            width: `${((e - s) / duration) * 100}%`,
        };
    }, [selectionStart, selectionEnd, duration]);

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
                            onClick={() => { revertVideo(); setSelectedCutIndex(null); }}
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
                            setSelectedCutIndex(null);
                            setSelectionStart(null);
                            setSelectionEnd(null);
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
                                Arrastra en el timeline para marcar un corte.&nbsp;
                                Haz clic en un corte (rojo) para seleccionarlo.&nbsp;
                                Pulsa <kbd className="bg-blue-800 px-1 rounded">Suprimir</kbd> para eliminar el seleccionado.
                            </span>
                        </div>
                    )}

                    {/* Timeline Area */}
                    <div
                        ref={timelineRef}
                        className={`bg-gray-900 mb-1 sm:mb-2 rounded border overflow-hidden flex flex-col relative shrink-0 select-none
                            ${editMode
                                ? 'border-blue-700 cursor-crosshair'
                                : 'border-gray-700 cursor-crosshair'
                            }`}
                        onMouseDown={handleTimelineMouseDown}
                        onMouseMove={handleTimelineMouseMove}
                        onMouseUp={handleTimelineMouseUp}
                        onMouseLeave={handleTimelineMouseUp}
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
                                    if (editMode) return; // Don't allow offset dragging in edit mode
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
                                style={{ cursor: editMode ? 'crosshair' : isDraggingOffset ? 'grabbing' : 'grab' }}
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

                        {/* Cut region overlays (committed) */}
                        {duration > 0 && cutRegions.map((region, idx) => {
                            const left = (region.start / duration) * 100;
                            const width = ((region.end - region.start) / duration) * 100;
                            const isSelected = selectedCutIndex === idx;
                            return (
                                <div
                                    key={idx}
                                    className={`absolute top-0 bottom-0 z-20 transition-colors cursor-pointer
                                        ${isSelected
                                            ? 'bg-red-500/40 border-2 border-red-400'
                                            : 'bg-red-900/35 border border-red-700/60 hover:bg-red-800/45'
                                        }`}
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedCutIndex(isSelected ? null : idx);
                                    }}
                                    title={`Corte: ${fmt(region.start)} – ${fmt(region.end)}. Selecciona y pulsa Suprimir para eliminar.`}
                                >
                                    {/* Scissors icon on wider cuts */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-red-300 text-[10px] opacity-75 select-none">✂</span>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-700 text-white text-[8px] px-1 py-0.5 rounded whitespace-nowrap z-30 pointer-events-none">
                                            {fmt(region.start)}–{fmt(region.end)} · Supr para borrar
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Active selection overlay (in-progress drag) */}
                        {editMode && selectionOverlay && (
                            <div
                                className="absolute top-0 bottom-0 z-25 bg-blue-500/30 border border-blue-400/70 pointer-events-none"
                                style={{ left: selectionOverlay.left, width: selectionOverlay.width }}
                            />
                        )}

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
