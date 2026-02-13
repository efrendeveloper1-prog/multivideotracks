'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PresentationPage() {
    const searchParams = useSearchParams();
    const src = searchParams.get('src');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const connection = (navigator as any).presentation?.receiver?.connectionList;
        if (connection) {
            connection.then((list: any) => {
                list.connections.forEach((conn: any) => {
                    conn.addEventListener('message', (event: MessageEvent) => {
                        const data = JSON.parse(event.data);
                        if (data.type === 'play' && videoRef.current) {
                            videoRef.current.src = data.src;
                            videoRef.current.currentTime = data.currentTime || 0;
                            videoRef.current.play();
                        }
                    });
                });
            });
        }
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-black">
            <video ref={videoRef} controls autoPlay className="max-w-full max-h-full" />
        </div>
    );
}
