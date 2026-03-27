'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const SecondScreen: React.FC = () => {
    const { tracks, isPlaying, isInCutRegion, lyrics, currentTime, lyricsSettings, invertBackground, setInvertBackground, videoOpacity, showLyrics } = useAudioEngine();
    const [secondWindow, setSecondWindow] = useState<Window | null>(null);
    const [isBlackout, setIsBlackout] = useState(false);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const isActive = !!secondWindow && !secondWindow.closed;

    const lyricsRef = useRef(lyrics);
    const currentTimeRef = useRef(currentTime);
    const isPlayingRef = useRef(isPlaying);
    const lyricsSettingsRef = useRef(lyricsSettings);
    const invertBackgroundRef = useRef(invertBackground);
    const videoOpacityRef = useRef(videoOpacity);

    const showLyricsRef = useRef(showLyrics);
    useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
    useEffect(() => { lyricsSettingsRef.current = lyricsSettings; }, [lyricsSettings]);
    useEffect(() => { invertBackgroundRef.current = invertBackground; }, [invertBackground]);
    useEffect(() => { videoOpacityRef.current = videoOpacity; }, [videoOpacity]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { showLyricsRef.current = showLyrics; }, [showLyrics]);

    const toggleSecondScreen = useCallback(() => {
        // If active, close the window
        if (secondWindow && !secondWindow.closed) {
            secondWindow.close();
            setSecondWindow(null);
            channelRef.current?.close();
            channelRef.current = null;
            return;
        }

        // Removed constraint to allow opening without video or lyrics

        // Open a new window (user drags it to the second monitor)
        const win = window.open(
            '/presentation',
            'secondScreen',
            'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
        );

        if (!win) {
            alert('No se pudo abrir la ventana. Permite pop-ups en tu navegador.');
            return;
        }

        setSecondWindow(win);

        // Use BroadcastChannel to communicate with the presentation window
        const channel = new BroadcastChannel('second-screen-video');
        channelRef.current = channel;

        channel.onmessage = (event) => {
            if (event.data.type === 'ready') {
                const videoEl = document.querySelector('video') as HTMLVideoElement | null;
                const t = currentTimeRef.current;
                const mostRecentBlock = lyricsRef.current
                    .filter(l => l.startTime !== null && l.startTime <= t)
                    .sort((a, b) => b.startTime! - a.startTime!)[0];
                    
                let activeLyricBlock = mostRecentBlock;
                if (activeLyricBlock && activeLyricBlock.endTime && activeLyricBlock.endTime < t) {
                    activeLyricBlock = undefined as any;
                }
                    
                const activeLyricText = activeLyricBlock ? activeLyricBlock.text : null;

                channel.postMessage({
                    type: 'sync',
                    src: videoEl?.src || null,
                    currentTime: videoEl?.currentTime || 0,
                    playing: videoEl ? !videoEl.paused : false,
                    currentLyric: activeLyricText,
                    lyricsSettings: lyricsSettingsRef.current,
                    invertBackground: invertBackgroundRef.current,
                    videoOpacity: videoOpacityRef.current,
                    showLyrics: showLyricsRef.current
                });
            }
        };

        // Clean up on main window unload
        window.addEventListener('beforeunload', () => {
            win.close();
            channel.close();
        }, { once: true });

    }, [secondWindow, tracks]);

    // Global interval to constantly sync the CURRENT video element on the page to the second window
    useEffect(() => {
        if (!isActive || !channelRef.current) return;

        const syncInterval = setInterval(() => {
            if (secondWindow?.closed) return;

            const t = currentTimeRef.current;
            const mostRecentBlock = lyricsRef.current
                .filter(l => l.startTime !== null && l.startTime <= t)
                .sort((a, b) => b.startTime! - a.startTime!)[0];
                
            let activeLyricBlock = mostRecentBlock;
            if (activeLyricBlock && activeLyricBlock.endTime && activeLyricBlock.endTime < t) {
                activeLyricBlock = undefined as any; // Cast to bypass strict checks if needed, or just let it become falsy
            }
                
            const activeLyricText = activeLyricBlock ? activeLyricBlock.text : null;

            const videoEl = document.querySelector('video') as HTMLVideoElement | null;
            
            let sendTime = t;
            let sendPlaying = isPlayingRef.current;
            let sendSrc = videoEl?.src || null;
            let sendOpacity = videoOpacityRef.current;

            if (isBlackout || isInCutRegion) {
                sendTime = 0;
                sendPlaying = false;
                sendSrc = null;
                sendOpacity = 0;
            } else if (videoEl) {
                sendTime = videoEl.currentTime;
                sendPlaying = !videoEl.paused;
                sendSrc = videoEl.src;
            }

            channelRef.current!.postMessage({
                type: 'sync',
                currentTime: sendTime,
                playing: sendPlaying,
                src: sendSrc,
                currentLyric: activeLyricText,
                lyricsSettings: lyricsSettingsRef.current,
                invertBackground: invertBackgroundRef.current,
                videoOpacity: sendOpacity,
                showLyrics: showLyricsRef.current
            });
        }, 300); // 300ms is good for lyric sync

        return () => clearInterval(syncInterval);
    }, [isActive, secondWindow, isBlackout, isInCutRegion, showLyrics]);

    // Check periodically if the window is still open
    React.useEffect(() => {
        if (!secondWindow) return;
        const check = setInterval(() => {
            if (secondWindow.closed) {
                setSecondWindow(null);
                channelRef.current?.close();
                channelRef.current = null;
                clearInterval(check);
            }
        }, 1000);
        return () => clearInterval(check);
    }, [secondWindow]);

    return (
        <div className="flex gap-2">
            <button
                onClick={toggleSecondScreen}
                className={`
                    flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded
                    transition-all duration-200 text-[11px] font-medium
                    ${isActive
                        ? 'bg-green-900/40 text-green-400 border border-green-700/50 hover:bg-green-900/60'
                        : 'bg-gray-800 text-red-400 border border-gray-700 hover:bg-gray-700'
                    }
                `}
                title={isActive ? 'Segunda pantalla activa - Click para desconectar' : 'Enviar a segunda pantalla'}
            >
                {/* Dual Monitor SVG Icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 shrink-0"
                >
                    {/* Front monitor */}
                    <rect x="1" y="4" width="13" height="10" rx="1" />
                    <line x1="4" y1="14" x2="10" y2="14" />
                    <line x1="7" y1="14" x2="7" y2="17" />
                    <line x1="4" y1="17" x2="10" y2="17" />
                    {/* Back monitor */}
                    <rect x="10" y="1" width="13" height="10" rx="1" />
                    <line x1="13" y1="11" x2="19" y2="11" />
                    <line x1="16" y1="11" x2="16" y2="14" />
                    <line x1="13" y1="14" x2="19" y2="14" />
                </svg>

                {/* Status dot */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />

                <span className="truncate">
                    {isActive ? 'ON' : '2nd Screen'}
                </span>
            </button>

            <button
                onClick={() => setIsBlackout(prev => !prev)}
                className={`
                    flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded
                    transition-all duration-200 text-[11px] font-medium
                    ${isBlackout
                        ? 'bg-red-900/40 text-red-500 border border-red-700/50 hover:bg-red-900/60'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }
                `}
                title={isBlackout ? 'Restaurar imagen' : 'Mandar a negro (Blackout)'}
            >
                <span className="text-sm font-bold truncate shrink-0">×</span>
                <span className="truncate">Clear</span>
            </button>

            <button
                onClick={() => setInvertBackground(prev => !prev)}
                className={`
                    flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded
                    transition-all duration-200 text-[11px] font-medium
                    ${invertBackground
                        ? 'bg-white text-black border border-gray-300 hover:bg-gray-100'
                        : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }
                `}
                title={invertBackground ? 'Fondo claro (click para oscuro)' : 'Fondo oscuro (click para claro)'}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    className="w-4 h-4 shrink-0"
                >
                    <path d="M12 22c4.97 0 9-4.03 9-9 0-4.97-9-11-9-11S3 8.03 3 13c0 4.97 4.03 9 9 9zm0-18.73c2.4 2.87 6 7.42 6 9.73 0 3.31-2.69 6-6 6V3.27z" fill="currentColor"/>
                </svg>
            </button>
        </div>
    );
};
