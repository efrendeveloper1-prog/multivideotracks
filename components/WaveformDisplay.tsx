import React, { useEffect, useRef, useMemo } from 'react';

interface WaveformDisplayProps {
    buffer: AudioBuffer | undefined;
    color: string;
    height?: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ buffer, color = '#4ade80', height = 48 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Precompute downsampled peaks once when buffer changes
    const peaks = useMemo(() => {
        if (!buffer) return null;
        const channelData = buffer.getChannelData(0);
        const P = 256; // 256 samples per peak (downsampling factor)
        const numPeaks = Math.ceil(channelData.length / P);
        const max = new Float32Array(numPeaks);
        const min = new Float32Array(numPeaks);

        for (let i = 0; i < numPeaks; i++) {
            let localMin = 1.0;
            let localMax = -1.0;
            const start = i * P;
            const end = Math.min(start + P, channelData.length);
            for (let j = start; j < end; j++) {
                const val = channelData[j];
                if (val < localMin) localMin = val;
                if (val > localMax) localMax = val;
            }
            max[i] = localMax;
            min[i] = localMin;
        }
        return { max, min, P };
    }, [buffer]);

    useEffect(() => {
        if (!buffer || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Find the timeline scroll container
        const scrollContainer = container.closest('.timeline-scroll-container') as HTMLDivElement | null;

        const draw = () => {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            if (containerWidth === 0 || containerHeight === 0) return;

            let drawWidth = containerWidth;
            let drawHeight = containerHeight;
            let scrollLeft = 0;

            if (scrollContainer) {
                scrollLeft = scrollContainer.scrollLeft;
                drawWidth = scrollContainer.clientWidth;
                drawHeight = scrollContainer.clientHeight;

                // Position canvas inside the wrapper to match the viewport
                canvas.style.left = `${scrollLeft}px`;
                canvas.style.width = `${drawWidth}px`;
                canvas.style.height = `${drawHeight}px`;
            } else {
                canvas.style.left = '0px';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
            }

            const dpr = window.devicePixelRatio || 1;
            canvas.width = drawWidth * dpr;
            canvas.height = drawHeight * dpr;
            ctx.scale(dpr, dpr);

            ctx.clearRect(0, 0, drawWidth, drawHeight);
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;

            const totalLength = buffer.length;
            const amp = drawHeight / 2;

            // Determine visible range ratios
            const rStart = scrollLeft / containerWidth;
            const rEnd = (scrollLeft + drawWidth) / containerWidth;

            const sampleStart = Math.floor(Math.max(0, rStart * totalLength));
            const sampleEnd = Math.floor(Math.min(totalLength, rEnd * totalLength));
            const numSamplesVisible = sampleEnd - sampleStart;

            const step = numSamplesVisible / drawWidth;

            ctx.beginPath();
            
            for (let i = 0; i < drawWidth; i++) {
                // Calculate sample range for this pixel column
                const sStart = Math.floor(sampleStart + i * step);
                const sEnd = Math.min(Math.floor(sampleStart + (i + 1) * step), totalLength);

                let min = 1.0;
                let max = -1.0;

                if (peaks) {
                    const { min: peaksMin, max: peaksMax, P } = peaks;
                    // Index ranges in peaks cache
                    const pStart = Math.floor(sStart / P);
                    const pEnd = Math.floor(sEnd / P);

                    if (pEnd > pStart) {
                        for (let p = pStart; p < pEnd; p++) {
                            if (peaksMin[p] < min) min = peaksMin[p];
                            if (peaksMax[p] > max) max = peaksMax[p];
                        }
                    } else {
                        // Fallback to raw data for high zoom level
                        const channelData = buffer.getChannelData(0);
                        for (let s = sStart; s < sEnd; s++) {
                            const val = channelData[s];
                            if (val < min) min = val;
                            if (val > max) max = val;
                        }
                    }
                } else {
                    // Fallback if peaks not computed yet
                    const channelData = buffer.getChannelData(0);
                    for (let s = sStart; s < sEnd; s++) {
                        const val = channelData[s];
                        if (val < min) min = val;
                        if (val > max) max = val;
                    }
                }

                // If no samples inside this step, use 0
                if (min === 1.0 && max === -1.0) {
                    min = 0;
                    max = 0;
                }

                const yMin = (1 + min) * amp;
                const yMax = (1 + max) * amp;
                ctx.moveTo(i, yMin);
                ctx.lineTo(i, yMax);
            }
            ctx.stroke();
        };

        // Set up observers
        const resizeObserver = new ResizeObserver(() => {
            draw();
        });
        resizeObserver.observe(container);

        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', draw, { passive: true });
        }

        draw(); // Initial draw

        return () => {
            resizeObserver.disconnect();
            if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', draw);
            }
        };
    }, [buffer, color, peaks]);

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden pointer-events-none">
            <canvas
                ref={canvasRef}
                className="absolute top-0 h-full pointer-events-none"
                style={{ left: 0, width: '100%' }}
            />
        </div>
    );
};
