'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StemUploader } from './StemUploader';
import { VideoUploader } from './VideoUploader';
import { SecondScreen } from './SecondScreen';
import { MixerBoard } from './MixerBoard';
import { TransportControls } from './TransportControls';
import { SongList } from './SongList';
import { AudioEngineProvider, useAudioEngine } from '@/hooks/useAudioEngine';
import { WaveformDisplay } from './WaveformDisplay';
import '@twick/studio/dist/studio.css'; // Keep css if used by other components or remove if possible

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

    // Format helpers
    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper for wave color
    const getWaveColor = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drum') || n.includes('bateria')) return '#06b6d4'; // cyan
        if (n.includes('bass') || n.includes('bajo')) return '#0d9488'; // teal
        if (n.includes('vox') || n.includes('voz')) return '#2563eb'; // blue
        if (n.includes('click')) return '#dc2626'; // red
        return '#94a3b8'; // slate
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">
            {/* Header / Info Bar */}
            <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-bold text-gray-300">LOAD SETLIST</button>
                    <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-bold text-gray-300">MIDI</button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-gray-800 px-4 py-1 rounded text-green-500 font-mono font-bold">
                        {fmt(currentTime)} / {fmt(duration)}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-bold text-gray-300">EDIT SONG</button>
                    <SecondScreen />
                </div>
            </div>

            {/* Main Workspace: Tracks (Top/Center) + Video (Hidden/Bg) */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Video Player - Hidden or Background */}
                {videoSrc && (
                    <div className="absolute top-0 right-0 w-64 h-36 bg-black z-50 border border-gray-800 shadow-xl opacity-90 hover:opacity-100 transition-opacity">
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            className="w-full h-full object-contain"
                            muted // Mute video so we only hear audio engine stems (if video has audio)
                        />
                    </div>
                )}

                {/* Left: Mixer Grid */}
                <div className="flex-1 bg-gray-800/50 p-2 overflow-x-auto relative z-10 flex flex-col">
                    {/* Timeline / Waveform Area */}
                    <div className="h-48 bg-gray-900 mb-2 rounded border border-gray-700 overflow-hidden flex flex-col relative">
                        {/* Draw stacked waveforms */}
                        {tracks.length > 0 ? (
                            tracks.map((track) => (
                                <div key={track.id} className="flex-1 border-b border-gray-800/50 relative group bg-gray-900">
                                    <div className="absolute left-0 top-0 text-[10px] text-gray-400 p-1 z-10 bg-black/50 pointer-events-none">{track.name}</div>
                                    <WaveformDisplay buffer={track.buffer!} color={track.color || getWaveColor(track.name)} />
                                </div>
                            ))
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                                Timeline View / Waveforms
                            </div>
                        )}

                        {/* Playhead Cursor */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>

                    {/* Mixer Channels */}
                    <div className="flex-1 overflow-hidden">
                        <MixerBoard />
                    </div>
                </div>

                {/* Right: Setlist / Sidebar */}
                <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-20">
                    <SongList />

                    <div className="p-2 border-t border-gray-800">
                        <StemUploader />
                        <div className="mt-2 text-xs text-center text-gray-500">Upload Stems ZIP</div>

                        <div className="mt-2 border-t border-gray-800 pt-2">
                            <VideoUploader />
                            <div className="mt-1 text-xs text-center text-gray-500">Sync Video</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: Transport Controls */}
            <div className="h-32 bg-gray-900 border-t border-gray-800 p-2 z-30">
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
