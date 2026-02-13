import React, { useRef, useEffect } from 'react';
import Waviz from 'waviz';

interface AudioWaveformProps {
    audioUrl: string;
    color?: string;
    height?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
    audioUrl,
    color = '#3b82f6',
    height = 80,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !audioRef.current) return;

        const waviz = new Waviz(canvasRef.current, audioRef.current);

        const handlePlay = async () => {
            await waviz.input.initializePending();
            waviz.visualizer.simpleBars(color);
        };

        const audio = audioRef.current;
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', () => waviz.visualizer.stop());

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', () => waviz.visualizer.stop());
        };
    }, [audioUrl, color]);

    return (
        <div>
            <canvas ref={canvasRef} width={600} height={height} className="w-full" />
            <audio ref={audioRef} src={audioUrl} controls className="hidden" />
        </div>
    );
};
