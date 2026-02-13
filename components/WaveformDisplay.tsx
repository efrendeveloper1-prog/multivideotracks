import React, { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
    buffer: AudioBuffer | undefined;
    color: string;
    height?: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ buffer, color = '#4ade80', height = 48 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!buffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;

        // Draw Logic
        // Downsample for performance (otherwise looping 5-20 million samples is slow)
        const channelData = buffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;

        ctx.beginPath();
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            for (let j = 0; j < step; j++) {
                const idx = (i * step) + j;
                if (idx < channelData.length) {
                    const datum = channelData[idx];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }

            // Draw vertical line from min to max
            // Normalize audio data (-1 to 1) to canvas height
            const yMin = (1 + min) * amp;
            const yMax = (1 + max) * amp;
            // ctx.fillRect(i, yMin, 1, Math.max(1, yMax - yMin));

            // Optimization: just draw center peak for aesthetic if dense
            // Or use lineTo
            ctx.moveTo(i, yMin);
            ctx.lineTo(i, yMax);
        }
        ctx.strokeStyle = color;
        ctx.stroke();

    }, [buffer, color, height]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
        />
    );
};
