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

        const draw = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width === 0 || height === 0) return;

            // Handle high DPI displays
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = color;

            const channelData = buffer.getChannelData(0);
            const step = Math.ceil(channelData.length / width);
            const amp = height / 2;

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;

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

                const yMin = (1 + min) * amp;
                const yMax = (1 + max) * amp;
                ctx.moveTo(i, yMin);
                ctx.lineTo(i, yMax);
            }
            ctx.stroke();
        };

        const resizeObserver = new ResizeObserver(() => {
            draw();
        });

        resizeObserver.observe(canvas);
        draw(); // Initial draw

        return () => {
            resizeObserver.disconnect();
        };
    }, [buffer, color]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
        />
    );
};
