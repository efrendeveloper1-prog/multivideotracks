'use client';

import { useEffect, useRef, Suspense } from 'react';

function PresentationContent() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        const channel = new BroadcastChannel('second-screen-video');
        channelRef.current = channel;

        // Tell the main window we're ready
        channel.postMessage({ type: 'ready' });

        channel.onmessage = (event) => {
            const video = videoRef.current;
            if (!video) return;

            if (event.data.type === 'load-video') {
                video.src = event.data.src;
                video.currentTime = event.data.currentTime || 0;
                video.play().catch(() => { });
            }

            if (event.data.type === 'sync') {
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
            {/* Instruction overlay - fades out */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs animate-pulse pointer-events-none">
                Doble click para pantalla completa
            </div>
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
