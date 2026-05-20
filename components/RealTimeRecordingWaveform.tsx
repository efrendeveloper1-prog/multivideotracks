'use client';

import React, { useEffect, useRef } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const RealTimeRecordingWaveform: React.FC = () => {
    const { getRecordingTimeDomainData, isRecording } = useAudioEngine();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const historyMaxRef = useRef<Float32Array>(new Float32Array(2000));
    const historyMinRef = useRef<Float32Array>(new Float32Array(2000));

    useEffect(() => {
        if (!isRecording || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dataArray = new Float32Array(2048);
        let animationFrameId: number;

        const historyMax = historyMaxRef.current;
        const historyMin = historyMinRef.current;

        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);

            getRecordingTimeDomainData(dataArray);

            const width = canvas.width;
            const height = canvas.height;

            // Calculate min/max for the current frame
            let min = 1.0;
            let max = -1.0;
            for (let i = 0; i < dataArray.length; i++) {
                if (dataArray[i] > max) max = dataArray[i];
                if (dataArray[i] < min) min = dataArray[i];
            }

            // Shift history
            for (let i = 0; i < width - 1; i++) {
                historyMax[i] = historyMax[i + 1];
                historyMin[i] = historyMin[i + 1];
            }
            historyMax[width - 1] = max;
            historyMin[width - 1] = min;

            ctx.clearRect(0, 0, width, height);

            // Draw center line
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#374151'; // gray-700
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            // Draw waveform
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ef4444'; // red-500
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            
            ctx.beginPath();
            for (let i = 0; i < width; i++) {
                const x = i;
                const yMax = (1 - (historyMax[i] + 1) / 2) * height;
                if (i === 0) ctx.moveTo(x, yMax);
                else ctx.lineTo(x, yMax);
            }
            for (let i = width - 1; i >= 0; i--) {
                const x = i;
                const yMin = (1 - (historyMin[i] + 1) / 2) * height;
                ctx.lineTo(x, yMin);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isRecording, getRecordingTimeDomainData]);

    // Handle canvas resize
    useEffect(() => {
        const resizeCanvas = () => {
            if (canvasRef.current) {
                const parent = canvasRef.current.parentElement;
                if (parent) {
                    canvasRef.current.width = parent.clientWidth;
                    canvasRef.current.height = parent.clientHeight;
                }
            }
        };

        window.addEventListener('resize', resizeCanvas);
        // Delay slightly to ensure layout is complete before sizing
        setTimeout(resizeCanvas, 0);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    return (
        <div className="w-full h-full relative">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full block"
            />
            <div className="absolute top-1 left-1 z-20 bg-red-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-white font-bold pointer-events-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                GRABANDO
            </div>
        </div>
    );
};
