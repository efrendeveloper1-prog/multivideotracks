import React, { useEffect, useState, useRef } from 'react';

interface VideoTimelineTrackProps {
    videoFile: File;
    duration: number;
    height?: number;
}

export const VideoTimelineTrack: React.FC<VideoTimelineTrackProps> = ({ videoFile, duration, height = 64 }) => {
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!videoFile || !duration) return;

        const generateThumbnails = async () => {
            // Create a temporary video element
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.muted = true;
            video.crossOrigin = "anonymous";

            // Wait for metadata
            await new Promise((resolve) => {
                video.onloadedmetadata = () => resolve(true);
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Determine how many thumbnails to fit
            // Let's assume a fix width for thumbnails for now or a count
            // Ideally we fill the container width. 
            // Since this component might be mounted in a container with dynamic width, 
            // let's generate a fixed count for MVP or based on approximate duration/width ratio.
            const count = 10;
            const interval = duration / count;
            const newThumbnails: string[] = [];

            // Set canvas size (adjust for desired thumbnail resolution)
            canvas.width = 160;
            canvas.height = 90;

            for (let i = 0; i < count; i++) {
                const time = i * interval;
                video.currentTime = time;

                // Wait for seek
                await new Promise((resolve) => {
                    video.onseeked = () => resolve(true);
                });

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                newThumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
            }

            setThumbnails(newThumbnails);

            // Cleanup
            URL.revokeObjectURL(video.src);
            video.remove();
            canvas.remove();
        };

        generateThumbnails();
    }, [videoFile, duration]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex overflow-hidden bg-gray-900"
            style={{ height: `${height}px` }}
        >
            {thumbnails.map((src, idx) => (
                <div key={idx} className="flex-1 h-full border-r border-gray-800 relative">
                    <img
                        src={src}
                        alt={`frame-${idx}`}
                        className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity"
                    />
                </div>
            ))}
        </div>
    );
};
