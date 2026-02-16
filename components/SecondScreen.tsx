'use client';

import React, { useCallback, useEffect, useState } from 'react';

export const SecondScreen: React.FC = () => {
    const [presentation, setPresentation] = useState<any>(null);
    const [available, setAvailable] = useState(false);
    const isActive = !!presentation;

    useEffect(() => {
        if (typeof window !== 'undefined' && 'PresentationRequest' in window) {
            setAvailable(true);
        }
    }, []);

    const togglePresentation = useCallback(async () => {
        if (isActive) {
            // Close presentation
            presentation?.close();
            setPresentation(null);
            return;
        }

        // Find video source from DOM
        const videoEl = document.querySelector('video');
        const videoSrc = videoEl?.src;

        if (!videoSrc) {
            alert('No hay video cargado para mostrar en segunda pantalla');
            return;
        }

        try {
            const presentationUrl = `/presentation?src=${encodeURIComponent(videoSrc)}`;
            const request = new (window as any).PresentationRequest(presentationUrl);
            const connection = await request.start();
            setPresentation(connection);

            connection.addEventListener('close', () => {
                setPresentation(null);
            });

            connection.send(JSON.stringify({
                type: 'play',
                src: videoSrc,
                currentTime: 0,
            }));
        } catch (error) {
            console.error('Error al iniciar presentación:', error);
        }
    }, [isActive, presentation]);

    if (!available) return null; // Hide entirely if not supported

    return (
        <button
            onClick={togglePresentation}
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
                <line x1="5" y1="14" x2="9" y2="17" />
                <line x1="9" y1="14" x2="5" y2="17" />
                <line x1="4" y1="17" x2="10" y2="17" />
                {/* Back monitor */}
                <rect x="10" y="1" width="13" height="10" rx="1" />
                <line x1="14" y1="11" x2="18" y2="14" />
                <line x1="18" y1="11" x2="14" y2="14" />
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
