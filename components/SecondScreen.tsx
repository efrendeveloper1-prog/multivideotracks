'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const SecondScreen: React.FC = () => {
    const { 
        tracks, 
        isPlaying, 
        isInCutRegion, 
        lyrics, 
        currentTime, 
        duration,
        lyricsSettings, 
        invertBackground, 
        setInvertBackground, 
        videoOpacity, 
        showLyrics 
    } = useAudioEngine();

    const [secondWindow, setSecondWindow] = useState<Window | null>(null);
    const [stageWindow, setStageWindow] = useState<Window | null>(null);
    const [isBlackout, setIsBlackout] = useState(false);
    
    const channelRef = useRef<BroadcastChannel | null>(null);
    const stageChannelRef = useRef<BroadcastChannel | null>(null);
    
    const isActive = !!secondWindow && !secondWindow.closed;
    const isStageActive = !!stageWindow && !stageWindow.closed;

    const lyricsRef = useRef(lyrics);
    const currentTimeRef = useRef(currentTime);
    const durationRef = useRef(duration);
    const isPlayingRef = useRef(isPlaying);
    const lyricsSettingsRef = useRef(lyricsSettings);
    const invertBackgroundRef = useRef(invertBackground);
    const videoOpacityRef = useRef(videoOpacity);
    const showLyricsRef = useRef(showLyrics);

    useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
    useEffect(() => { durationRef.current = duration; }, [duration]);
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

    }, [secondWindow]);

    const toggleStageScreen = useCallback(() => {
        // If active, close the window
        if (stageWindow && !stageWindow.closed) {
            stageWindow.close();
            setStageWindow(null);
            stageChannelRef.current?.close();
            stageChannelRef.current = null;
            return;
        }

        // Open a new window (user drags it to the stage monitor)
        const win = window.open(
            '/stage',
            'stageScreen',
            'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
        );

        if (!win) {
            alert('No se pudo abrir la ventana. Permite pop-ups en tu navegador.');
            return;
        }

        setStageWindow(win);

        // Use BroadcastChannel to communicate with the stage window
        const channel = new BroadcastChannel('stage-screen');
        stageChannelRef.current = channel;

        channel.onmessage = (event) => {
            if (event.data.type === 'ready') {
                const t = currentTimeRef.current;
                const timedLyrics = lyricsRef.current
                    .filter(l => l.startTime !== null)
                    .sort((a, b) => a.startTime! - b.startTime!);

                const mostRecentBlock = lyricsRef.current
                    .filter(l => l.startTime !== null && l.startTime <= t)
                    .sort((a, b) => b.startTime! - a.startTime!)[0];
                    
                let activeLyricBlock = mostRecentBlock;
                if (activeLyricBlock && activeLyricBlock.endTime && activeLyricBlock.endTime < t) {
                    activeLyricBlock = undefined as any;
                }
                    
                const activeLyricText = activeLyricBlock ? activeLyricBlock.text : null;

                // Find next slide text
                let nextLyricText = null;
                if (activeLyricBlock) {
                    const currentIndex = timedLyrics.findIndex(l => l.id === activeLyricBlock.id);
                    if (currentIndex !== -1 && currentIndex + 1 < timedLyrics.length) {
                        nextLyricText = timedLyrics[currentIndex + 1].text;
                    }
                } else {
                    const nextBlock = timedLyrics.find(l => l.startTime! > t);
                    if (nextBlock) {
                        nextLyricText = nextBlock.text;
                    }
                }

                channel.postMessage({
                    type: 'sync',
                    currentLyric: activeLyricText,
                    nextLyric: nextLyricText,
                    currentTime: t,
                    duration: durationRef.current,
                    isPlaying: isPlayingRef.current
                });
            }
        };

        // Clean up on main window unload
        window.addEventListener('beforeunload', () => {
            win.close();
            channel.close();
        }, { once: true });

    }, [stageWindow]);

    // Global interval to constantly sync state to active screens
    useEffect(() => {
        if (!isActive && !isStageActive) return;

        const syncInterval = setInterval(() => {
            const t = currentTimeRef.current;
            const timedLyrics = lyricsRef.current
                .filter(l => l.startTime !== null)
                .sort((a, b) => a.startTime! - b.startTime!);

            const mostRecentBlock = lyricsRef.current
                .filter(l => l.startTime !== null && l.startTime <= t)
                .sort((a, b) => b.startTime! - a.startTime!)[0];
                
            let activeLyricBlock = mostRecentBlock;
            if (activeLyricBlock && activeLyricBlock.endTime && activeLyricBlock.endTime < t) {
                activeLyricBlock = undefined as any;
            }
                
            const activeLyricText = activeLyricBlock ? activeLyricBlock.text : null;

            // Synchronize Audience Display (secondScreen)
            if (isActive && channelRef.current && !secondWindow?.closed) {
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

                channelRef.current.postMessage({
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
            }

            // Synchronize Stage Display (stageScreen)
            if (isStageActive && stageChannelRef.current && !stageWindow?.closed) {
                let nextLyricText = null;
                if (activeLyricBlock) {
                    const currentIndex = timedLyrics.findIndex(l => l.id === activeLyricBlock.id);
                    if (currentIndex !== -1 && currentIndex + 1 < timedLyrics.length) {
                        nextLyricText = timedLyrics[currentIndex + 1].text;
                    }
                } else {
                    const nextBlock = timedLyrics.find(l => l.startTime! > t);
                    if (nextBlock) {
                        nextLyricText = nextBlock.text;
                    }
                }

                stageChannelRef.current.postMessage({
                    type: 'sync',
                    currentLyric: activeLyricText,
                    nextLyric: nextLyricText,
                    currentTime: t,
                    duration: durationRef.current,
                    isPlaying: isPlayingRef.current
                });
            }
        }, 300);

        return () => clearInterval(syncInterval);
    }, [isActive, isStageActive, secondWindow, stageWindow, isBlackout, isInCutRegion, showLyrics]);

    // Check periodically if the windows are still open
    useEffect(() => {
        if (!secondWindow && !stageWindow) return;
        const check = setInterval(() => {
            if (secondWindow && secondWindow.closed) {
                setSecondWindow(null);
                channelRef.current?.close();
                channelRef.current = null;
            }
            if (stageWindow && stageWindow.closed) {
                setStageWindow(null);
                stageChannelRef.current?.close();
                stageChannelRef.current = null;
            }
        }, 1000);
        return () => clearInterval(check);
    }, [secondWindow, stageWindow]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <button
                    onClick={toggleSecondScreen}
                    className={`
                        flex items-center justify-center gap-1.5 w-1/2 py-1.5 px-2 rounded
                        transition-all duration-200 text-[11px] font-medium
                        ${isActive
                            ? 'bg-green-900/40 text-green-400 border border-green-700/50 hover:bg-green-900/60'
                            : 'bg-gray-800 text-red-400 border border-gray-700 hover:bg-gray-700'
                        }
                    `}
                    title={isActive ? 'Segunda pantalla activa - Click para desconectar' : 'Enviar a segunda pantalla'}
                >
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
                        <rect x="1" y="4" width="13" height="10" rx="1" />
                        <line x1="4" y1="14" x2="10" y2="14" />
                        <line x1="7" y1="14" x2="7" y2="17" />
                        <line x1="4" y1="17" x2="10" y2="17" />
                        <rect x="10" y="1" width="13" height="10" rx="1" />
                        <line x1="13" y1="11" x2="19" y2="11" />
                        <line x1="16" y1="11" x2="16" y2="14" />
                        <line x1="13" y1="14" x2="19" y2="14" />
                    </svg>

                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />

                    <span className="truncate">
                        {isActive ? 'ON' : 'Audience'}
                    </span>
                </button>

                <button
                    onClick={toggleStageScreen}
                    className={`
                        flex items-center justify-center gap-1.5 w-1/2 py-1.5 px-2 rounded
                        transition-all duration-200 text-[11px] font-medium
                        ${isStageActive
                            ? 'bg-green-900/40 text-green-400 border border-green-700/50 hover:bg-green-900/60'
                            : 'bg-gray-800 text-yellow-400 border border-gray-700 hover:bg-gray-700'
                        }
                    `}
                    title={isStageActive ? 'Pantalla de escenario activa - Click para desconectar' : 'Enviar a pantalla de escenario'}
                >
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
                        <path d="M4 19h16" />
                        <path d="m10 5-6 8h16l-6-8z" />
                    </svg>

                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStageActive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />

                    <span className="truncate">
                        {isStageActive ? 'ON' : 'Escenario'}
                    </span>
                </button>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setIsBlackout(prev => !prev)}
                    className={`
                        flex items-center justify-center gap-1.5 w-1/2 py-1.5 px-2 rounded
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
                        flex items-center justify-center gap-1.5 w-1/2 py-1.5 px-2 rounded
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
                    <span className="truncate">Invert</span>
                </button>
            </div>
        </div>
    );
};

