import React from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const TransportControls: React.FC = () => {
    const {
        isPlaying,
        togglePlay,
        stop,
        currentTime,
        duration,
        masterVolume,
        setMasterVolume
    } = useAudioEngine();

    // Formatting helper
    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
            {/* Master Fader Placeholder */}
            <div className="flex flex-col items-center mr-6 group relative">
                <span className="text-xs font-bold text-gray-400 mb-1">MASTER</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="w-32 cursor-pointer"
                />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center gap-4">
                <button
                    onClick={stop}
                    className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                >
                    <div className="w-6 h-6 bg-white rounded-sm"></div>
                </button>

                <button
                    onClick={togglePlay}
                    className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                >
                    {isPlaying ? (
                        <div className="flex gap-2">
                            <div className="w-3 h-8 bg-white rounded-sm"></div>
                            <div className="w-3 h-8 bg-white rounded-sm"></div>
                        </div>
                    ) : (
                        <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[30px] border-l-white border-b-[15px] border-b-transparent ml-2"></div>
                    )}
                </button>

                <div className="flex flex-col gap-2 ml-4">
                    <button className="w-12 h-12 bg-gray-600 rounded flex items-center justify-center hover:bg-gray-500">
                        <span className="text-white text-xl">↻</span>
                    </button>
                    <button className="w-12 h-12 bg-gray-600 rounded flex items-center justify-center hover:bg-gray-500">
                        <span className="text-white text-xl">⇄</span>
                    </button>
                </div>
            </div>

            {/* Song Info / LCD Display */}
            <div className="flex-1 ml-8 bg-gray-900 p-2 rounded border border-gray-600 font-mono text-green-400 flex flex-col items-end justify-center">
                <div className="text-2xl">{fmt(currentTime)} / {fmt(duration)}</div>
                <div className="text-sm text-gray-400">4/4 • 72 BPM</div>
            </div>

            <div className="ml-4 flex flex-col gap-2">
                <div className="bg-gray-700 px-3 py-1 rounded text-xs font-bold">KEY: Eb</div>
                <div className="bg-gray-700 px-3 py-1 rounded text-xs font-bold">TEMPO: 72</div>
            </div>
        </div>
    );
};
