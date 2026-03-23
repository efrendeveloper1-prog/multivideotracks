'use client';

import { useEffect, useRef, useState, Suspense } from 'react';

interface LyricsSettings {
    align: 'left' | 'center' | 'right';
    position: 'top' | 'middle' | 'bottom';
    fontSize: number;
    fontFamily: string;
    animation: 'none' | 'blur-in' | 'slide-up' | 'zoom-in';
}

function PresentationContent() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const [currentLyric, setCurrentLyric] = useState<string | null>(null);
    const [lyricsSettings, setLyricsSettings] = useState<LyricsSettings | null>(null);

    useEffect(() => {
        const channel = new BroadcastChannel('second-screen-video');
        channelRef.current = channel;

        // Tell the main window we're ready
        channel.postMessage({ type: 'ready' });

        channel.onmessage = (event) => {
            const video = videoRef.current;
            if (!video) return;

            if (event.data.type === 'sync') {
                // If src changed, update it
                if (event.data.src !== undefined && video.src !== event.data.src) {
                    if (event.data.src) {
                        video.src = event.data.src;
                        video.load();
                    } else {
                        video.removeAttribute('src');
                        video.load();
                    }
                }
                // Only correct if drift > 0.5 seconds
                const drift = Math.abs(video.currentTime - event.data.currentTime);
                if (drift > 0.5) {
                    video.currentTime = event.data.currentTime;
                }

                if (event.data.playing && video.paused) {
                    video.play().catch(() => { });
                } else if (!event.data.playing && !video.paused) {
                    video.pause();
                }

                if (event.data.currentLyric !== undefined) {
                    setCurrentLyric(event.data.currentLyric);
                }
                if (event.data.lyricsSettings !== undefined) {
                    setLyricsSettings(event.data.lyricsSettings);
                }
            }
        };

        return () => {
            channel.close();
        };
    }, []);

    return (
        <div
            className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden cursor-none"
            onDoubleClick={() => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else {
                    document.exitFullscreen().catch(() => { });
                }
            }}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
            />

            {/* Lyrics Overlay */}
            {currentLyric && lyricsSettings && (
                <div className={`absolute inset-x-0 flex flex-col z-50 pointer-events-none px-4 md:px-12
                    ${lyricsSettings.position === 'top' ? 'top-[10vh] justify-start' : 
                      lyricsSettings.position === 'middle' ? 'inset-y-0 justify-center' : 
                      'bottom-[10vh] justify-end'}`}
                >
                    <div 
                        key={currentLyric}
                        className={`w-full max-w-6xl space-y-1 sm:space-y-2 md:space-y-4 mx-auto
                        ${lyricsSettings.align === 'left' ? 'text-left' :
                          lyricsSettings.align === 'right' ? 'text-right' : 'text-center'}
                        ${lyricsSettings.animation !== 'none' ? `animate-${lyricsSettings.animation}` : ''}`}
                    >
                        {currentLyric.split('\n').map((line, i) => (
                            <p 
                                key={i} 
                                className="text-white font-bold tracking-tight block"
                                style={{
                                    textShadow: '0px 4px 20px rgba(0,0,0,0.9), 0px 2px 8px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)',
                                    lineHeight: '1.2',
                                    fontFamily: lyricsSettings.fontFamily,
                                    fontSize: `${Math.max(20, lyricsSettings.fontSize)}px`
                                }}
                            >
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

export default function PresentationPage() {
    return (
        <Suspense fallback={
            <div className="w-screen h-screen bg-black flex items-center justify-center text-white">
                Cargando...
            </div>
        }>
            <PresentationContent />
        </Suspense>
    );
}
