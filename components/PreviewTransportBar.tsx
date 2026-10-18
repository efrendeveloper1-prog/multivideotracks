'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const PreviewTransportBar: React.FC = () => {
    const {
        currentTime,
        duration,
        isPlaying,
        togglePlay,
        seek,
        tracks,
        playlist,
        activeSongId,
    } = useAudioEngine();

    const [isDragging, setIsDragging] = useState(false);
    const [dragTime, setDragTime] = useState<number | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const lastSeekTimeRef = useRef<number>(0);

    // Active song / video title calculation
    const activeSong = useMemo(() => {
        return playlist.find(s => s.id === activeSongId);
    }, [playlist, activeSongId]);

    const videoTrack = useMemo(() => {
        return tracks.find(t => t.name === "VIDEO TRACK" || t.isVideoAudio);
    }, [tracks]);

    const displayTitle = useMemo(() => {
        if (videoTrack?.file?.name) {
            return videoTrack.file.name;
        }
        if (activeSong?.videoFile?.name) {
            return activeSong.videoFile.name;
        }
        if (activeSong?.title) {
            return activeSong.artist ? `${activeSong.title} - ${activeSong.artist}` : activeSong.title;
        }
        const anyNamedTrack = tracks.find(t => t.file?.name);
        if (anyNamedTrack?.file?.name) {
            return anyNamedTrack.file.name;
        }
        if (tracks.length > 0) {
            const audioTrack = tracks.find(t => t.name !== "VIDEO TRACK" && !t.isVideoAudio);
            return audioTrack?.name || tracks[0]?.name || 'Pistas activas';
        }
        return 'Sin reproducción';
    }, [activeSong, videoTrack, tracks]);

    // Time calculations
    const effectiveTime = isDragging && dragTime !== null ? dragTime : currentTime;
    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (effectiveTime / duration) * 100)) : 0;

    // Timecode formatters matching SMPTE/Holyrics: MM:SS;FF and -MM:SS;FF
    const formatTimecode = (sec: number) => {
        if (isNaN(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const f = Math.floor((sec % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')};${f.toString().padStart(2, '0')}`;
    };

    const formatRemainingTimecode = (curr: number, total: number) => {
        if (isNaN(total) || total <= 0) return "-00:00;00";
        const rem = Math.max(0, total - curr);
        const m = Math.floor(rem / 60);
        const s = Math.floor(rem % 60);
        const f = Math.floor((rem % 1) * 100);
        return `-${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')};${f.toString().padStart(2, '0')}`;
    };

    // Seeking logic
    const getTimeFromPointer = useCallback((clientX: number) => {
        if (!progressBarRef.current || duration <= 0) return 0;
        const rect = progressBarRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return ratio * duration;
    }, [duration]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (duration <= 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        const target = getTimeFromPointer(e.clientX);
        setDragTime(target);
        seek(target);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || duration <= 0) return;
        const target = getTimeFromPointer(e.clientX);
        setDragTime(target);

        // Throttle seeking during drag to ensure silky performance
        const now = Date.now();
        if (now - lastSeekTimeRef.current > 50) {
            lastSeekTimeRef.current = now;
            seek(target);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            const target = getTimeFromPointer(e.clientX);
            seek(target);
            setIsDragging(false);
            setDragTime(null);
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
        }
    };

    const handleRewind15 = () => {
        if (duration <= 0) return;
        seek(Math.max(0, currentTime - 15));
    };

    const handleForward15 = () => {
        if (duration <= 0) return;
        seek(Math.min(duration, currentTime + 15));
    };

    const handleSkipToEnd10 = () => {
        if (duration <= 0) return;
        seek(Math.max(0, duration - 10));
    };

    return (
        <div className="flex flex-col bg-[#242427] border-t border-[#3b3b40] shrink-0 text-white select-none px-3 pt-2 pb-2.5">
            {/* Centered Song Name */}
            <div 
                className="text-[12px] sm:text-[13px] font-medium text-gray-100 truncate text-center mb-1.5 px-1 tracking-tight"
                title={displayTitle}
            >
                {displayTitle}
            </div>

            {/* Scrubber / Progress Bar */}
            <div
                ref={progressBarRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative w-full h-5 flex items-center cursor-pointer select-none group touch-none"
                title="Clic o arrastra para mover la posición"
            >
                {/* Background Track */}
                <div className="w-full h-2 bg-[#525258] relative overflow-hidden">
                    {/* Progress Fill */}
                    <div
                        className="h-full bg-white transition-all duration-75"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Scrubber Thumb */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-4 bg-[#323236] border border-[#a8a8b0] shadow-md pointer-events-none transition-transform duration-75 group-hover:scale-110 group-hover:border-white"
                    style={{
                        left: `clamp(0px, calc(${progressPercent}% - 5px), calc(100% - 10px))`
                    }}
                />
            </div>

            {/* Timecodes: Current (left) & Negative Remaining (right) */}
            <div className="flex justify-between items-center text-[11px] font-mono font-medium text-gray-300 px-0.5 select-none leading-none -mt-0.5 mb-1.5">
                <span>{formatTimecode(effectiveTime)}</span>
                <span>{formatRemainingTimecode(effectiveTime, duration)}</span>
            </div>

            {/* Playback Controls: ↺15 | ▶/⏸ | ↻15 | -10⇥ */}
            <div className="flex items-center justify-center gap-5 select-none text-gray-300">
                {/* Rewind 15s */}
                <button
                    onClick={handleRewind15}
                    disabled={duration <= 0}
                    className="p-1 rounded hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Retroceder 15 segundos"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4.5A8.5 8.5 0 1 0 19.5 13" />
                        <path d="M11 1.5v3.5h-3.5" />
                        <text x="11.5" y="15.5" fontSize="7.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">15</text>
                    </svg>
                </button>

                {/* Play / Pause Toggle */}
                <button
                    onClick={togglePlay}
                    disabled={duration <= 0}
                    className="p-1.5 rounded-full hover:text-white hover:bg-white/10 active:scale-90 transition-all text-white disabled:opacity-40 disabled:pointer-events-none"
                    title={isPlaying ? "Pausar" : "Reproducir (Espacio)"}
                >
                    {isPlaying ? (
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 fill-current translate-x-0.5" viewBox="0 0 24 24">
                            <path d="M5 3.868v16.264a1 1 0 0 0 1.545.841l13.012-8.132a1 1 0 0 0 0-1.682L6.545 3.027A1 1 0 0 0 5 3.868z" />
                        </svg>
                    )}
                </button>

                {/* Forward 15s */}
                <button
                    onClick={handleForward15}
                    disabled={duration <= 0}
                    className="p-1 rounded hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Avanzar 15 segundos"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 4.5A8.5 8.5 0 1 1 4.5 13" />
                        <path d="M13 1.5v3.5h3.5" />
                        <text x="12.5" y="15.5" fontSize="7.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">15</text>
                    </svg>
                </button>

                {/* Skip -10 to End (stacked icon matching image) */}
                <button
                    onClick={handleSkipToEnd10}
                    disabled={duration <= 10}
                    className="p-1 rounded hover:text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex flex-col items-center justify-center leading-none"
                    title="Ir a los últimos 10 segundos (-10s)"
                >
                    <span className="text-[9px] font-bold tracking-tight text-gray-300 -mb-0.5">-10</span>
                    <svg className="w-4 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12h12" />
                        <path d="m11 7 5 5-5 5" />
                        <path d="M20 6v12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
