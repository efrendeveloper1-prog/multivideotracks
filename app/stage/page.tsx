'use client';

import { useEffect, useState, Suspense } from 'react';

function StageContent() {
    const [currentLyric, setCurrentLyric] = useState<string | null>(null);
    const [nextLyric, setNextLyric] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [systemTime, setSystemTime] = useState<Date>(new Date());

    // Update local system clock every second
    useEffect(() => {
        const interval = setInterval(() => {
            setSystemTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // BroadcastChannel sync
    useEffect(() => {
        const channel = new BroadcastChannel('stage-screen');
        
        // Let the sender know we are ready
        channel.postMessage({ type: 'ready' });

        channel.onmessage = (event) => {
            if (event.data.type === 'sync') {
                if (event.data.currentLyric !== undefined) setCurrentLyric(event.data.currentLyric);
                if (event.data.nextLyric !== undefined) setNextLyric(event.data.nextLyric);
                if (event.data.currentTime !== undefined) setCurrentTime(event.data.currentTime);
                if (event.data.duration !== undefined) setDuration(event.data.duration);
                if (event.data.isPlaying !== undefined) setIsPlaying(event.data.isPlaying);
            }
        };

        return () => {
            channel.close();
        };
    }, []);

    // Helper to format playback time (MM:SS)
    const formatPlaybackTime = (secs: number) => {
        if (isNaN(secs) || secs < 0) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Helper to format system clock (HH:MM:SS AM/PM)
    const formatSystemTime = (date: Date) => {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true 
        });
    };

    // Calculate remaining time
    const remainingTime = Math.max(0, duration - currentTime);

    return (
        <div
            className="w-screen h-screen flex flex-col justify-between p-8 md:p-12 select-none bg-black text-white font-sans overflow-hidden"
            onDoubleClick={() => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }}
        >
            {/* Top Section: Current Lyric */}
            <div className="flex flex-col flex-[1.2] items-center justify-center min-h-0 px-4">
                <span className="text-zinc-500 text-xs md:text-sm uppercase tracking-widest font-bold mb-4 shrink-0">
                    DIAPOSITIVA ACTUAL
                </span>
                <div className="flex-1 flex items-center justify-center w-full min-h-0">
                    <p className="text-4xl sm:text-5xl md:text-7xl font-bold text-center leading-tight whitespace-pre-wrap max-h-full overflow-hidden text-zinc-100">
                        {currentLyric || ''}
                    </p>
                </div>
            </div>

            {/* Divider line */}
            <div className="w-full border-t-2 border-zinc-800 my-4 shrink-0" />

            {/* Middle Section: Next Lyric */}
            <div className="flex flex-col flex-1 items-center justify-center min-h-0 px-4">
                <span className="text-zinc-500 text-xs md:text-sm uppercase tracking-widest font-bold mb-2 shrink-0">
                    SIGUIENTE DIAPOSITIVA
                </span>
                <div className="flex-1 flex items-center justify-center w-full min-h-0">
                    <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-center leading-tight whitespace-pre-wrap max-h-full overflow-hidden text-amber-400">
                        {nextLyric || ''}
                    </p>
                </div>
            </div>

            {/* Bottom Section: Dashboard (Timers & Clock) */}
            <div className="grid grid-cols-3 gap-6 w-full text-center border-t-2 border-zinc-800 pt-6 shrink-0">
                {/* Timer (Elapsed) */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-6 flex flex-col justify-center items-center">
                    <span className="text-amber-500 font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                        {formatPlaybackTime(currentTime)}
                    </span>
                    <span className="text-zinc-400 text-[10px] md:text-sm uppercase tracking-widest font-semibold mt-2">
                        TRANSCURRIDO
                    </span>
                </div>

                {/* System Clock (Local Time) */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-6 flex flex-col justify-center items-center">
                    <span className="text-zinc-100 font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                        {formatSystemTime(systemTime)}
                    </span>
                    <span className="text-zinc-400 text-[10px] md:text-sm uppercase tracking-widest font-semibold mt-2">
                        HORA LOCAL
                    </span>
                </div>

                {/* Video Countdown (Remaining Time) */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-6 flex flex-col justify-center items-center">
                    <span className="text-zinc-100 font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                        {formatPlaybackTime(remainingTime)}
                    </span>
                    <span className="text-zinc-400 text-[10px] md:text-sm uppercase tracking-widest font-semibold mt-2">
                        RESTANTE
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function StagePage() {
    return (
        <Suspense fallback={
            <div className="w-screen h-screen bg-black flex items-center justify-center text-white">
                Cargando Escenario...
            </div>
        }>
            <StageContent />
        </Suspense>
    );
}
