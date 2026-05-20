import React, { useRef, useEffect } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

interface MixerChannelProps {
    trackId: string;
    name: string;
    volume: number;
    pan: number;
    isMuted: boolean;
    isSoloed: boolean;
    onVolumeChange: (id: string, volume: number) => void;
    onPanChange: (id: string, pan: number) => void;
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

const PanKnob: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
    // Value is -1 to 1. Angle ranges from -135 to 135 degrees
    const angle = value * 135;

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        // we capture the pointer to receive events even when the mouse leaves the element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const startY = e.clientY;
        const startValue = value;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaY = startY - moveEvent.clientY;
            // Sensitivity: 150 pixels for full sweep (-1 to 1 is range of 2)
            let newValue = startValue + (deltaY / 75);
            newValue = Math.max(-1, Math.min(1, newValue));

            // Snap to center if close
            if (Math.abs(newValue) < 0.05) newValue = 0;

            onChange(newValue);
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
            (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const handleDoubleClick = () => onChange(0);

    return (
        <div className="flex flex-col items-center mb-1 select-none w-full">
            <div
                className="relative w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-600 cursor-ns-resize"
                onPointerDown={handlePointerDown}
                onDoubleClick={handleDoubleClick}
                title="Pan (Drag up/down, Double-click to center)"
            >
                <div
                    className="w-full h-full rounded-full transition-transform duration-75"
                    style={{ transform: `rotate(${angle}deg)` }}
                >
                    <div className="mx-auto mt-0.5 w-0.5 h-2.5 bg-white rounded-sm" />
                </div>
            </div>
            <div className="flex justify-between w-[40px] px-[0.1rem] mt-0.5 text-[9px] font-bold text-gray-500">
                <span>L</span>
                <span>R</span>
            </div>
        </div>
    );
};

export const MixerChannel: React.FC<MixerChannelProps> = ({
    trackId,
    name,
    volume,
    pan,
    isMuted,
    isSoloed,
    onVolumeChange,
    onPanChange,
    onMuteToggle,
    onSoloToggle,
}) => {
    const { getTrackLevel, isPlaying, downloadTrack, removeTrack } = useAudioEngine();
    const meterRef = useRef<HTMLDivElement>(null);
    const baseColor = getTrackColor(name);

    useEffect(() => {
        if (!meterRef.current) return;

        let animationFrameId: number;

        const updateMeter = () => {
            const level = getTrackLevel(trackId);
            if (meterRef.current) {
                meterRef.current.style.height = `${level * 100}%`;
            }
            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateMeter);
            }
        };

        if (isPlaying) {
            updateMeter();
        } else {
            updateMeter(); // Draw once when stopped to clear
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [getTrackLevel, isPlaying, trackId]);

    // Calculate fader height percentage
    const faderHeight = `${Math.min(Math.max(volume * 100, 0), 100)}%`;

    return (
        <div className="flex flex-col w-[100px] h-full mx-1">
            {/* Main Channel Strip Area */}
            <div className="flex-1 relative mb-2 mt-2 flex flex-row gap-[2px]">
                {/* Meter container */}
                <div className="w-1.5 h-full relative bg-gray-900 rounded-sm overflow-hidden shrink-0">
                    <div
                        ref={meterRef}
                        className="absolute bottom-0 left-0 w-full bg-green-500 origin-bottom"
                        style={{ height: '0%' }}
                    />
                </div>

                <div className={`flex-1 relative rounded overflow-hidden bg-gray-700/50 border border-gray-600 group`}>
                    {/* Delete button */}
                    <button 
                        className="absolute top-1 right-1 z-20 text-gray-400 hover:text-red-500 bg-black/40 hover:bg-black/80 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de que quieres eliminar esta pista?')) {
                                removeTrack(trackId);
                            }
                        }}
                        title="Eliminar pista"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>

                    {/* Background "Fader" Level */}
                    <div
                        className={`absolute bottom-0 left-0 w-full transition-all duration-100 ease-out opacity-60 ${baseColor}`}
                        style={{ height: faderHeight }}
                    />

                    {/* Vertical Text Name */}
                    <div className="absolute inset-0 flex items-center justify-center p-2 z-10 pointer-events-none">
                        <span className="text-white font-bold tracking-wider text-xl uppercase rotate-[-90deg] whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
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
            </div>

            {/* Bottom Controls Area */}
            <div className="flex flex-col gap-2 pb-1 shrink-0">
                {/* Pan Knob */}
                <PanKnob value={pan} onChange={(newPan) => onPanChange(trackId, newPan)} />

                {/* Mute and Solo Buttons */}
                <div className="flex flex-row gap-1 px-1">
                    <button
                        onClick={() => onMuteToggle(trackId)}
                        className={`flex-1 h-8 rounded-md font-bold text-sm transition-colors ${isMuted
                            ? 'bg-red-600/90 text-white shadow-inner'
                            : 'bg-[#2A2A2A] text-gray-300 hover:bg-[#3A3A3A] hover:text-white border border-gray-700/50'
                            }`}
                        title="Mute"
                    >
                        M
                    </button>
                    <button
                        onClick={() => onSoloToggle(trackId)}
                        className={`flex-1 h-8 rounded-md font-bold text-sm transition-colors ${isSoloed
                            ? 'bg-yellow-500 text-black shadow-inner'
                            : 'bg-[#2A2A2A] text-gray-300 hover:bg-[#3A3A3A] hover:text-white border border-gray-700/50'
                            }`}
                        title="Solo"
                    >
                        S
                    </button>
                </div>
                {/* Download Button */}
                <div className="flex px-1 mt-1">
                    <button
                        onClick={() => downloadTrack(trackId)}
                        className="flex-1 h-6 rounded bg-[#2A2A2A] text-gray-400 hover:bg-[#3A3A3A] hover:text-white border border-gray-700/50 flex items-center justify-center transition-colors"
                        title="Descargar pista localmente"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v6.879l2.8-2.81a.75.75 0 111.06 1.06l-4.125 4.125a.75.75 0 01-1.06 0L5.3 8.88a.75.75 0 111.06-1.06l2.89 2.9V3.75A.75.75 0 0110 3zM4 14a.75.75 0 01.75.75v1.5a.75.75 0 00.75.75h9a.75.75 0 00.75-.75v-1.5a.75.75 0 011.5 0v1.5A2.25 2.25 0 0114.5 18h-9A2.25 2.25 0 013 15.75v-1.5A.75.75 0 014 14z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Visual Indicator Line (Green/Red sidebar like in Prime) - Optional */}
            <div className={`h-1 w-full mt-1 rounded ${baseColor}`}></div>
        </div>
    );
};
