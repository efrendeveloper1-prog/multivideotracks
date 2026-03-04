'use client';

import React, { useEffect, useRef } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const AudioMeter: React.FC = () => {
    const { getMasterLevels, isPlaying } = useAudioEngine();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const draw = () => {
            const levels = getMasterLevels();
            const { width, height } = canvas;

            ctx.clearRect(0, 0, width, height);

            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, width, height);

            const drawBar = (level: number, x: number, barWidth: number) => {
                const filledHeight = Math.min(level, 1) * height;

                // create gradient
                const gradient = ctx.createLinearGradient(0, height, 0, 0);
                gradient.addColorStop(0, '#22c55e'); // Green
                gradient.addColorStop(0.7, '#eab308'); // Yellow
                gradient.addColorStop(1, '#ef4444'); // Red

                ctx.fillStyle = gradient;
                ctx.fillRect(x, height - filledHeight, barWidth, filledHeight);
            };

            const barWidth = (width - 4) / 2; // 2px gap (1px on each side + 2px between)
            drawBar(levels[0], 1, barWidth); // L
            drawBar(levels[1], 1 + barWidth + 2, barWidth); // R

            if (isPlaying) {
                animationFrameId = requestAnimationFrame(draw);
            }
        };

        if (isPlaying) {
            draw();
        } else {
            draw(); // Draw once when stopped
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [getMasterLevels, isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            width={12}
            height={80}
            className="w-3 h-full max-h-[80px] rounded border border-gray-800 bg-black/60 shadow-lg"
        />
    );
};
