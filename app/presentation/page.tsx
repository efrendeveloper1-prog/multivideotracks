'use client';

import { useEffect, useRef, useState, Suspense } from 'react';

interface LyricsSettings {
    align: 'left' | 'center' | 'right';
    position: 'top' | 'middle' | 'bottom';
    fontSize: number;
    fontFamily: string;
    animation: 'none' | 'blur-in' | 'slide-up' | 'zoom-in';
    idleAnimation?: 'none' | 'float-pulse-shine' | 'zoom-in-slow' | 'zoom-out-slow';
    exitAnimation?: 'none' | 'slide-down-stagger';
}

function PresentationContent() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const [currentLyric, setCurrentLyric] = useState<string | null>(null);
    const [displayedLyric, setDisplayedLyric] = useState<string | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [lyricsSettings, setLyricsSettings] = useState<LyricsSettings | null>(null);
    const [invertBackground, setInvertBackground] = useState<boolean>(false);
    const [showLyrics, setShowLyrics] = useState<boolean>(true);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
                if (event.data.invertBackground !== undefined) {
                    setInvertBackground(event.data.invertBackground);
                }
                if (event.data.showLyrics !== undefined) {
                    setShowLyrics(event.data.showLyrics);
                }
                if (event.data.videoOpacity !== undefined) {
                    video.style.opacity = event.data.videoOpacity.toString();
                }
            }
        };

        return () => {
            if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
            channel.close();
        };
    }, []);

    // Handle lyrics transitions
    useEffect(() => {
        if (currentLyric !== displayedLyric) {
            if (!displayedLyric) {
                setDisplayedLyric(currentLyric);
                setIsExiting(false);
            } else {
                const hasExitAnim = lyricsSettings?.exitAnimation && lyricsSettings.exitAnimation !== 'none';
                if (hasExitAnim) {
                    setIsExiting(true);
                    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
                    exitTimeoutRef.current = setTimeout(() => {
                        setDisplayedLyric(currentLyric);
                        setIsExiting(false);
                    }, 550); // Match staggering duration
                } else {
                    setDisplayedLyric(currentLyric);
                    setIsExiting(false);
                }
            }
        }
    }, [currentLyric, displayedLyric, lyricsSettings]);

    return (
        <div
            className={`w-screen h-screen flex items-center justify-center overflow-hidden cursor-none transition-colors duration-500 ${invertBackground ? 'bg-white' : 'bg-black'}`}
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
            {showLyrics && displayedLyric && lyricsSettings && (
                <div className={`absolute inset-x-0 flex flex-col z-50 pointer-events-none px-4 md:px-12
                    ${lyricsSettings.position === 'top' ? 'top-[10vh] justify-start' : 
                      lyricsSettings.position === 'middle' ? 'inset-y-0 justify-center' : 
                      'bottom-[10vh] justify-end'}`}
                >
                    <div 
                        key={displayedLyric}
                        className={`w-full max-w-6xl space-y-1 sm:space-y-2 md:space-y-4 mx-auto
                        ${lyricsSettings.align === 'left' ? 'text-left' :
                          lyricsSettings.align === 'right' ? 'text-right' : 'text-center'}
                        ${isExiting ? 'animate-exit-down' : 
                          lyricsSettings.animation === 'blur-in' ? 'animate-blur-in' : 
                          lyricsSettings.animation === 'slide-up' ? 'animate-slide-up' : 
                          lyricsSettings.animation === 'zoom-in' ? 'animate-zoom-in' : ''}`}
                    >
                        {displayedLyric.split('\n').map((line, i) => (
                            <p 
                                key={i} 
                                className={`font-bold tracking-tight block transition-all
                                    ${invertBackground ? 'text-black' : 'text-white'}
                                    ${!isExiting && lyricsSettings.idleAnimation === 'float-pulse-shine' ? 'animate-idle-float-pulse animate-shine-glitch' : ''}
                                    ${!isExiting && lyricsSettings.idleAnimation === 'zoom-in-slow' ? 'animate-zoom-in-slow' : ''}
                                    ${!isExiting && lyricsSettings.idleAnimation === 'zoom-out-slow' ? 'animate-zoom-out-slow' : ''}
                                    ${isExiting ? 'animate-exit-down' : ''}
                                `}
                                style={{
                                    textShadow: invertBackground ? 'none' : '0px 4px 20px rgba(0,0,0,0.8), 0px 2px 8px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)',
                                    lineHeight: '1.2',
                                    fontFamily: lyricsSettings.fontFamily,
                                    fontSize: `${Math.max(24, lyricsSettings.fontSize)}px`,
                                    backgroundImage: (!invertBackground && lyricsSettings.idleAnimation === 'float-pulse-shine') ? 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)' : 'none',
                                    backgroundSize: '200% auto',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    display: 'inline-block',
                                    width: '100%',
                                    animationDelay: isExiting ? `${i * 100}ms` : '0ms'
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
