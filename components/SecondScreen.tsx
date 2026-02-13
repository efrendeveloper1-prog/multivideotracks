import React, { useCallback, useEffect, useState } from 'react';
import { useTimeline } from '@twick/timeline';

export const SecondScreen: React.FC = () => {
    const { getTracks } = useTimeline();
    const [presentation, setPresentation] = useState<PresentationConnection | null>(null);
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'PresentationRequest' in window) {
            setAvailable(true);
        }
    }, []);

    const startPresentation = useCallback(async () => {
        const tracks = getTracks();
        const videoTrack = tracks.find(t => t.type === 'video');
        if (!videoTrack) {
            alert('No hay video cargado para mostrar en segunda pantalla');
            return;
        }

        try {
            const presentationUrl = `/presentation?src=${encodeURIComponent(videoTrack.src)}`;
            const request = new (window as any).PresentationRequest(presentationUrl);
            const connection = await request.start();
            setPresentation(connection);

            connection.addEventListener('message', (event: MessageEvent) => {
                console.log('Mensaje desde presentación:', event.data);
            });

            connection.send(JSON.stringify({
                type: 'play',
                src: videoTrack.src,
                currentTime: 0,
            }));
        } catch (error) {
            console.error('Error al iniciar presentación:', error);
        }
    }, [getTracks]);

    const closePresentation = useCallback(() => {
        presentation?.close();
        setPresentation(null);
    }, [presentation]);

    if (!available) {
        return (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded">
                Tu navegador no soporta la API de segunda pantalla. Prueba con Chrome/Edge.
            </div>
        );
    }

    return (
        <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium mb-2">🖥️ Segunda Pantalla</h3>
            <button
                onClick={startPresentation}
                disabled={!!presentation}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
                {presentation ? 'Presentación activa' : 'Enviar video a segunda pantalla'}
            </button>
            {presentation && (
                <button
                    onClick={closePresentation}
                    className="ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                    Cerrar
                </button>
            )}
        </div>
    );
};
