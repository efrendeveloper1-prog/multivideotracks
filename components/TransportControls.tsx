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
        setMasterVolume,
        songAnalysis
    } = useAudioEngine();

    // Formatting helper
    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const bpmDisplay = songAnalysis?.bpm || '--';
    const keyDisplay = songAnalysis?.keyDisplay || '--';

    return (
        <div className="flex items-center justify-between bg-gray-800 p-2 sm:p-4 rounded-lg border border-gray-700 h-full">
            {/* Master Fader */}
            <div className="flex flex-col items-center mr-2 sm:mr-6 group relative shrink-0">
                <span className="text-[9px] sm:text-xs font-bold text-gray-400 mb-1">MASTER</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="w-20 sm:w-32 cursor-pointer"
                />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <button
                    onClick={stop}
                    className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                >
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-sm"></div>
                </button>

                <button
                    onClick={togglePlay}
                    className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                >
                    {isPlaying ? (
                        <div className="flex gap-1.5">
                            <div className="w-2 h-6 sm:w-3 sm:h-7 bg-white rounded-sm"></div>
                            <div className="w-2 h-6 sm:w-3 sm:h-7 bg-white rounded-sm"></div>
                        </div>
                    ) : (
                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[20px] border-l-white border-b-[10px] border-b-transparent ml-1 sm:border-t-[12px] sm:border-l-[24px] sm:border-b-[12px]"></div>
                    )}
                </button>
            </div>

            {/* Song Info / LCD Display */}
            <div className="flex-1 mx-2 sm:mx-4 bg-gray-900 p-2 rounded border border-gray-600 font-mono text-green-400 flex flex-col items-end justify-center min-w-0">
                <div className="text-lg sm:text-2xl">{fmt(currentTime)} / {fmt(duration)}</div>
                <div className="text-[10px] sm:text-sm text-gray-400">
                    4/4 • {bpmDisplay} BPM
                </div>
            </div>

            {/* Key & Tempo Info */}
            <div className="flex flex-col gap-1 sm:gap-2 shrink-0">
                <div className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold ${songAnalysis ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'bg-gray-700 text-gray-400'
                    }`}>
                    KEY: {keyDisplay}
                </div>
                <div className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold ${songAnalysis ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50' : 'bg-gray-700 text-gray-400'
                    }`}>
                    BPM: {bpmDisplay}
                </div>
            </div>
        </div>
    );
};
