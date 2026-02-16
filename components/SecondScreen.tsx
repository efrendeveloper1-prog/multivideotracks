'use client';

import React, { useCallback, useRef, useState } from 'react';

export const SecondScreen: React.FC = () => {
    const [secondWindow, setSecondWindow] = useState<Window | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const isActive = !!secondWindow && !secondWindow.closed;

    const toggleSecondScreen = useCallback(() => {
        // If active, close the window
        if (secondWindow && !secondWindow.closed) {
            secondWindow.close();
            setSecondWindow(null);
            channelRef.current?.close();
            channelRef.current = null;
            return;
        }

        // Find the video element in the main page
        const videoEl = document.querySelector('video') as HTMLVideoElement | null;
        if (!videoEl || !videoEl.src) {
            alert('No hay video cargado para mostrar en segunda pantalla');
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

        // Wait for the presentation page to signal it's ready, then send video src
        channel.onmessage = (event) => {
            if (event.data.type === 'ready') {
                channel.postMessage({
                    type: 'load-video',
                    src: videoEl.src,
                    currentTime: videoEl.currentTime
                });
            }
        };

        // Sync playback from main video to second screen
        const syncInterval = setInterval(() => {
            if (win.closed) {
                clearInterval(syncInterval);
                setSecondWindow(null);
                channel.close();
                channelRef.current = null;
                return;
            }
            if (videoEl) {
                channel.postMessage({
                    type: 'sync',
                    currentTime: videoEl.currentTime,
                    playing: !videoEl.paused,
                });
            }
        }, 500);

        // Clean up on main window unload
        window.addEventListener('beforeunload', () => {
            win.close();
            clearInterval(syncInterval);
            channel.close();
        }, { once: true });

    }, [secondWindow]);

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
    );
};
