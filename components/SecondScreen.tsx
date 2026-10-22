'use client';

import React, { useCallback, useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useAudioEngine, LyricBlock } from '@/hooks/useAudioEngine';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SecondScreenProps {
    activeLyricBlock?: LyricBlock | null;
    activeLyricText?: string | null;
}

export const SecondScreen: React.FC<SecondScreenProps> = ({
    activeLyricBlock: propActiveLyricBlock,
    activeLyricText: propActiveLyricText
}) => {
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

    // Pre-sort timed lyrics
    const timedLyrics = useMemo(() => {
        return lyrics
            .filter(l => l.startTime !== null)
            .sort((a, b) => a.startTime! - b.startTime!);
    }, [lyrics]);

    // Active lyric block fallback calculation if not passed via props
    const fallbackActiveBlock = useMemo(() => {
        if (propActiveLyricBlock !== undefined) return propActiveLyricBlock;
        const mostRecentBlock = lyrics
            .filter(l => l.startTime !== null && l.startTime <= currentTime)
            .sort((a, b) => b.startTime! - a.startTime!)[0];
            
        if (mostRecentBlock && mostRecentBlock.endTime && mostRecentBlock.endTime < currentTime) {
            return null;
        }
        return mostRecentBlock || null;
    }, [propActiveLyricBlock, lyrics, currentTime]);

    const activeBlock = propActiveLyricBlock !== undefined ? propActiveLyricBlock : fallbackActiveBlock;
    const activeText = propActiveLyricText !== undefined ? propActiveLyricText : (activeBlock ? activeBlock.text : null);

    // Calculate next lyric for Stage Display
    const nextLyricText = useMemo(() => {
        if (activeBlock) {
            const currentIndex = timedLyrics.findIndex(l => l.id === activeBlock.id);
            if (currentIndex !== -1 && currentIndex + 1 < timedLyrics.length) {
                return timedLyrics[currentIndex + 1].text;
            }
            return null;
        } else {
            const nextBlock = timedLyrics.find(l => l.startTime! > currentTime);
            return nextBlock ? nextBlock.text : null;
        }
    }, [timedLyrics, activeBlock, currentTime]);

    // Keep refs up to date on every render
    const activeTextRef = useRef(activeText);
    const nextTextRef = useRef(nextLyricText);
    const currentTimeRef = useRef(currentTime);
    const durationRef = useRef(duration);
    const isPlayingRef = useRef(isPlaying);
    const lyricsSettingsRef = useRef(lyricsSettings);
    const invertBackgroundRef = useRef(invertBackground);
    const videoOpacityRef = useRef(videoOpacity);
    const showLyricsRef = useRef(showLyrics);
    const isBlackoutRef = useRef(isBlackout);
    const isInCutRegionRef = useRef(isInCutRegion);

    activeTextRef.current = activeText;
    nextTextRef.current = nextLyricText;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    isPlayingRef.current = isPlaying;
    lyricsSettingsRef.current = lyricsSettings;
    invertBackgroundRef.current = invertBackground;
    videoOpacityRef.current = videoOpacity;
    showLyricsRef.current = showLyrics;
    isBlackoutRef.current = isBlackout;
    isInCutRegionRef.current = isInCutRegion;

    // Core broadcast synchronization function
    const broadcastSync = useCallback(() => {
        const t = currentTimeRef.current;
        const currentLyric = activeTextRef.current;
        const nextLyric = nextTextRef.current;
        const settings = lyricsSettingsRef.current;
        const invert = invertBackgroundRef.current;
        const lyricsVisible = showLyricsRef.current;
        const playing = isPlayingRef.current;
        const dur = durationRef.current;
        const blackout = isBlackoutRef.current;
        const cut = isInCutRegionRef.current;

        // Synchronize Audience Display (presentation)
        if (channelRef.current) {
            const videoEl = document.querySelector('video') as HTMLVideoElement | null;
            
            let sendTime = t;
            let sendPlaying = playing;
            let sendSrc = videoEl?.src || null;
            let sendOpacity = videoOpacityRef.current;

            if (blackout || cut) {
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
                currentLyric: currentLyric,
                lyricsSettings: settings,
                invertBackground: invert,
                videoOpacity: sendOpacity,
                showLyrics: lyricsVisible
            });
        }

        // Synchronize Stage Display (stage)
        if (stageChannelRef.current) {
            stageChannelRef.current.postMessage({
                type: 'sync',
                currentLyric: currentLyric,
                nextLyric: nextLyric,
                currentTime: t,
                duration: dur,
                isPlaying: playing
            });
        }
    }, []);

    // Ensure BroadcastChannels are initialized and listening for "ready" messages
    useEffect(() => {
        if (!channelRef.current) {
            const ch = new BroadcastChannel('second-screen-video');
            ch.onmessage = (event) => {
                if (event.data?.type === 'ready') {
                    broadcastSync();
                }
            };
            channelRef.current = ch;
        }

        if (!stageChannelRef.current) {
            const stageCh = new BroadcastChannel('stage-screen');
            stageCh.onmessage = (event) => {
                if (event.data?.type === 'ready') {
                    broadcastSync();
                }
            };
            stageChannelRef.current = stageCh;
        }

        return () => {
            channelRef.current?.close();
            channelRef.current = null;
            stageChannelRef.current?.close();
            stageChannelRef.current = null;
        };
    }, [broadcastSync]);

    // INSTANT SYNCHRONOUS BROADCAST when active lyric or next lyric changes
    // useIsomorphicLayoutEffect fires synchronously right after DOM mutations and before paint,
    // guaranteeing that Audience and Stage receive the new lyric at the exact same frame as Preview!
    const prevActiveTextRef = useRef<string | null>(null);
    const prevNextTextRef = useRef<string | null>(null);

    useIsomorphicLayoutEffect(() => {
        if (prevActiveTextRef.current !== activeText || prevNextTextRef.current !== nextLyricText) {
            prevActiveTextRef.current = activeText;
            prevNextTextRef.current = nextLyricText;
            broadcastSync();
        }
    }, [activeText, nextLyricText, broadcastSync]);

    // Instant broadcast when display toggles or settings change
    useEffect(() => {
        broadcastSync();
    }, [showLyrics, invertBackground, videoOpacity, isBlackout, isInCutRegion, lyricsSettings, isPlaying, broadcastSync]);

    // High-frequency periodic sync for video playback drift correction and smooth stage timer countdowns
    useEffect(() => {
        if (!isActive && !isStageActive) return;

        const syncInterval = setInterval(() => {
            broadcastSync();
        }, 50);

        return () => clearInterval(syncInterval);
    }, [isActive, isStageActive, broadcastSync]);

    // Check periodically if the popup windows were closed by the user
    useEffect(() => {
        if (!secondWindow && !stageWindow) return;
        const check = setInterval(() => {
            if (secondWindow && secondWindow.closed) {
                setSecondWindow(null);
            }
            if (stageWindow && stageWindow.closed) {
                setStageWindow(null);
            }
        }, 1000);
        return () => clearInterval(check);
    }, [secondWindow, stageWindow]);

    const toggleSecondScreen = useCallback(() => {
        if (secondWindow && !secondWindow.closed) {
            secondWindow.close();
            setSecondWindow(null);
            return;
        }

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

        // Immediate initial sync
        setTimeout(() => broadcastSync(), 100);

        window.addEventListener('beforeunload', () => {
            win.close();
        }, { once: true });
    }, [secondWindow, broadcastSync]);

    const toggleStageScreen = useCallback(() => {
        if (stageWindow && !stageWindow.closed) {
            stageWindow.close();
            setStageWindow(null);
            return;
        }

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

        // Immediate initial sync
        setTimeout(() => broadcastSync(), 100);

        window.addEventListener('beforeunload', () => {
            win.close();
        }, { once: true });
    }, [stageWindow, broadcastSync]);

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
