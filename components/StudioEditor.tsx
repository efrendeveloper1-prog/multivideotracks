'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SecondScreen } from './SecondScreen';
import { MixerBoard } from './MixerBoard';
import { TransportControls } from './TransportControls';
import { SongList } from './SongList';
import { AudioEngineProvider, useAudioEngine } from '@/hooks/useAudioEngine';
import { WaveformDisplay } from './WaveformDisplay';
import { VideoTimelineTrack } from './VideoTimelineTrack';

const EditorContent: React.FC = () => {
    const { setVideoElement, tracks, currentTime, duration, seek, videoDuration, trimVideoToAudio, videoOffset, setVideoOffset } = useAudioEngine();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isDraggingOffset, setIsDraggingOffset] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartOffsetRef = useRef<number>(0);

    useEffect(() => {
        if (videoRef.current) {
            setVideoElement(videoRef.current);
        }
    }, [setVideoElement]);

    const videoTrack = tracks.find(t => t.name === "VIDEO TRACK");

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

                <div className="flex items-center gap-1 sm:gap-3">
                    <button className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-gray-300 hidden sm:block">EDIT</button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative min-h-0">

                {/* Left: Timeline & Mixer */}
                <div className="flex-1 bg-gray-800/50 p-1 sm:p-2 relative z-10 flex flex-col min-w-0 min-h-0">
                    {/* Timeline Area — click to seek */}
                    <div
                        className="bg-gray-900 mb-1 sm:mb-2 rounded border border-gray-700 overflow-hidden flex flex-col relative shrink-0 cursor-crosshair"
                        onClick={(e) => {
                            if (duration <= 0) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const trackWidth = rect.width;
                            if (clickX < 0 || trackWidth <= 0) return;
                            const ratio = Math.min(Math.max(clickX / trackWidth, 0), 1);
                            seek(ratio * duration);
                        }}
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

                        {/* Video Track (Thumbnails) */}
                        {videoTrack && (
                            <div className="h-14 sm:h-20 border-b border-gray-700 relative flex shrink-0">
                                <div className="flex-1 relative h-full"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setIsDraggingOffset(true);
                                        dragStartXRef.current = e.clientX;
                                        dragStartOffsetRef.current = videoOffset;
                                    }}
                                    onMouseMove={(e) => {
                                        if (!isDraggingOffset) return;
                                        const deltaX = e.clientX - dragStartXRef.current;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const secondsPerPixel = duration / rect.width;
                                        setVideoOffset(dragStartOffsetRef.current + deltaX * secondsPerPixel);
                                    }}
                                    onMouseUp={() => setIsDraggingOffset(false)}
                                    onMouseLeave={() => setIsDraggingOffset(false)}
                                    style={{ cursor: isDraggingOffset ? 'grabbing' : 'grab' }}
                                >
                                    <VideoTimelineTrack videoFile={videoTrack.file} duration={duration} height={80} />
                                    {/* Overlay label */}
                                    <div className="absolute top-1 left-1 z-10 bg-purple-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-purple-300 font-bold pointer-events-none">
                                        VIDEO
                                    </div>
                                    {/* Offset badge */}
                                    {videoOffset !== 0 && (
                                        <div className="absolute top-1 right-1 z-10 bg-amber-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] text-amber-300 font-mono pointer-events-none">
                                            {videoOffset > 0 ? '+' : ''}{videoOffset.toFixed(1)}s
                                        </div>
                                    )}
                                    {/* Reset offset button */}
                                    {videoOffset !== 0 && (
                                        <button
                                            className="absolute bottom-1 right-1 z-10 bg-gray-700/80 hover:bg-gray-600 px-1 py-0.5 rounded text-[7px] text-gray-300"
                                            onClick={(e) => { e.stopPropagation(); setVideoOffset(0); }}
                                            title="Reset offset"
                                        >
                                            ↺ Reset
                                        </button>
                                    )}
                                </div>
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
                                {/* Overlay label */}
                                <div className="absolute top-1 left-1 z-10 bg-gray-800/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-green-400 font-bold pointer-events-none">
                                    MASTER
                                </div>
                            </div>
                        </div>

                        {/* Playhead Cursor */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>

                    {/* Mixer Channels */}
                    <div className="flex-1 overflow-hidden border-t border-gray-700 pt-1 sm:pt-2 text-white min-h-0">
                        <MixerBoard />
                    </div>
                </div>

                {/* Right: Sidebar (hidden on very small, collapsible) */}
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
