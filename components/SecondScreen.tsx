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
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm p-0.5 rounded border border-gray-800 shadow-md">
            {/* 1. Audiencia (Segunda Pantalla) */}
            <button
                onClick={toggleSecondScreen}
                className={`relative p-1 rounded transition-all duration-200 flex items-center justify-center ${
                    isActive
                        ? 'bg-green-600 text-white shadow-sm ring-1 ring-green-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={isActive ? 'Segunda pantalla (Audiencia) ACTIVA - Clic para desconectar' : 'Abrir segunda pantalla (Audiencia)'}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
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
                <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-300 animate-pulse' : 'bg-red-500'}`} />
            </button>

            {/* 2. Escenario (Stage Display) */}
            <button
                onClick={toggleStageScreen}
                className={`relative p-1 rounded transition-all duration-200 flex items-center justify-center ${
                    isStageActive
                        ? 'bg-yellow-600 text-white shadow-sm ring-1 ring-yellow-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={isStageActive ? 'Pantalla de Escenario ACTIVA - Clic para desconectar' : 'Abrir pantalla de Escenario'}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                >
                    <path d="M4 19h16" />
                    <path d="m10 5-6 8h16l-6-8z" />
                </svg>
                <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${isStageActive ? 'bg-yellow-300 animate-pulse' : 'bg-red-500'}`} />
            </button>

            {/* 3. Clear (Blackout) */}
            <button
                onClick={() => setIsBlackout(prev => !prev)}
                className={`p-1 rounded transition-all duration-200 flex items-center justify-center ${
                    isBlackout
                        ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400 animate-pulse'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={isBlackout ? 'Restaurar imagen en pantallas (Blackout ACTIVO)' : 'Mandar a negro (Blackout / Clear)'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            {/* 4. Invert */}
            <button
                onClick={() => setInvertBackground(prev => !prev)}
                className={`p-1 rounded transition-all duration-200 flex items-center justify-center ${
                    invertBackground
                        ? 'bg-white text-black shadow-sm ring-1 ring-gray-300'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={invertBackground ? 'Fondo claro activo (clic para volver a oscuro)' : 'Invertir a fondo claro'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M12 22c4.97 0 9-4.03 9-9 0-4.97-9-11-9-11S3 8.03 3 13c0 4.97 4.03 9 9 9zm0-18.73c2.4 2.87 6 7.42 6 9.73 0 3.31-2.69 6-6 6V3.27z" />
                </svg>
            </button>
        </div>
    );
};

