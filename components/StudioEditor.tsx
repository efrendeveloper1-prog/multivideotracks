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
    const { setVideoElement, tracks, currentTime, duration } = useAudioEngine();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);

    useEffect(() => {
        if (videoRef.current) {
            setVideoElement(videoRef.current);
        }
    }, [setVideoElement]);

    // Listener for video upload
    useEffect(() => {
        const handleVideo = (e: any) => {
            setVideoSrc(e.detail);
        };
        window.addEventListener('video-uploaded', handleVideo);
        return () => window.removeEventListener('video-uploaded', handleVideo);
    }, []);

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

    const videoTrack = tracks.find(t => t.name === "VIDEO TRACK");

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
                    {/* Timeline Area */}
                    <div className="bg-gray-900 mb-1 sm:mb-2 rounded border border-gray-700 overflow-hidden flex flex-col relative shrink-0">

                        {/* Video Track (Thumbnails) */}
                        {videoTrack && (
                            <div className="h-14 sm:h-20 border-b border-gray-700 relative flex shrink-0">
                                <div className="w-16 sm:w-24 bg-purple-900/30 border-r border-gray-700 flex items-center justify-center p-1 text-[9px] sm:text-[10px] text-purple-300 font-bold">
                                    VIDEO
                                </div>
                                <div className="flex-1 relative h-full">
                                    <VideoTimelineTrack videoFile={videoTrack.file} duration={duration} height={80} />
                                </div>
                            </div>
                        )}

                        {/* Master Waveform */}
                        <div className="h-20 sm:h-28 relative flex shrink-0">
                            <div className="w-16 sm:w-24 bg-gray-800 border-r border-gray-700 flex items-center justify-center p-1 text-[9px] sm:text-[10px] text-green-400 font-bold">
                                MASTER
                            </div>
                            <div className="flex-1 relative h-full bg-gray-950">
                                {masterBuffer ? (
                                    <WaveformDisplay buffer={masterBuffer} color="#4ade80" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] sm:text-xs">
                                        No audio loaded
                                    </div>
                                )}
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
