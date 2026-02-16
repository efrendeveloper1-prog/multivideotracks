import React from 'react';

interface MixerChannelProps {
    trackId: string;
    name: string;
    volume: number;
    isMuted: boolean;
    isSoloed: boolean;
    onVolumeChange: (id: string, volume: number) => void;
    onMuteToggle: (id: string) => void;
    onSoloToggle: (id: string) => void;
}

// Helper to determine color based on track name (simple heuristic)
const getTrackColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('drum') || n.includes('perc')) return 'bg-cyan-600';
    if (n.includes('bass')) return 'bg-teal-600';
    if (n.includes('guit') || n.includes('elec')) return 'bg-emerald-600';
    if (n.includes('key') || n.includes('piano') || n.includes('synth')) return 'bg-sky-600';
    if (n.includes('vox') || n.includes('bgv') || n.includes('choir')) return 'bg-blue-600';
    if (n.includes('click') || n.includes('cue')) return 'bg-red-600';
    if (n.includes('video')) return 'bg-purple-600';
    return 'bg-slate-600';
};

export const MixerChannel: React.FC<MixerChannelProps> = ({
    trackId,
    name,
    volume,
    isMuted,
    isSoloed,
    onVolumeChange,
    onMuteToggle,
    onSoloToggle,
}) => {
    const baseColor = getTrackColor(name);

    // Calculate fader height percentage
    const faderHeight = `${Math.min(Math.max(volume * 100, 0), 100)}%`;

    return (
        <div className="flex flex-col w-[100px] h-full mx-1">
            {/* Main Channel Strip Area */}
            <div className={`flex-1 relative mb-2 rounded overflow-hidden bg-gray-700/50 border border-gray-600 group`}>

                {/* Background "Fader" Level */}
                <div
                    className={`absolute bottom-0 left-0 w-full transition-all duration-100 ease-out opacity-60 ${baseColor}`}
                    style={{ height: faderHeight }}
                />

                {/* Vertical Text Name */}
                <div className="absolute inset-0 flex items-center justify-center p-2 z-10 pointer-events-none">
                    <span className="text-white font-bold tracking-wider text-xl uppercase rotate-[-90deg] whitespace-nowrap drop-shadow-md">
                        {name}
                    </span>
                </div>

                {/* Invisible Range Input for Dragging "Fader" */}
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => onVolumeChange(trackId, parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
                    style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                    title={`Volume: ${Math.round(volume * 100)}%`}
                />
            </div>

            {/* Buttons Container */}
            <div className="flex flex-col gap-1 h-[80px]">
                {/* ON/MUTE Button */}
                <button
                    onClick={() => onMuteToggle(trackId)}
                    className={`flex-1 font-bold text-sm tracking-widest transition-colors ${!isMuted
                        ? 'bg-gray-600 text-white border-b-2 border-gray-800'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                >
                    {!isMuted ? 'ON' : 'OFF'}
                </button>

                {/* SOLO Button */}
                <button
                    onClick={() => onSoloToggle(trackId)}
                    className={`h-[30px] text-xs font-bold tracking-widest transition-colors ${isSoloed
                        ? 'bg-gray-400 text-black'
                        : 'bg-gray-500 text-gray-300 hover:bg-gray-400 hover:text-white'
                        }`}
                >
                    SOLO
                </button>
            </div>

            {/* Visual Indicator Line (Green/Red sidebar like in Prime) - Optional */}
            <div className={`h-1 w-full mt-1 rounded ${baseColor}`}></div>
        </div>
    );
};
