import React from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { MixerChannel } from './MixerChannel';

export const MixerBoard: React.FC = () => {
    const {
        tracks,
        setTrackVolume,
        setTrackPan,
        toggleTrackMute,
        toggleTrackSolo
    } = useAudioEngine();

    return (
        <div className="flex flex-row h-full overflow-x-auto items-stretch pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900">
            {tracks.length === 0 && (
                <div className="text-gray-500 w-full h-full flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg m-4">
                    <button
                        onClick={() => document.getElementById('zip-upload-input')?.click()}
                        className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded transition-colors text-gray-300 hover:text-white flex items-center gap-2 cursor-pointer shadow hover:shadow-lg"
                        title="Agregar multitrack (ZIP)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Carga un multitrack para empezar
                    </button>
                </div>
            )}

            {tracks.map((track) => (
                <MixerChannel
                    key={track.id}
                    trackId={track.id}
                    name={track.name}
                    volume={track.volume}
                    pan={track.pan !== undefined ? track.pan : 0}
                    isMuted={track.muted}
                    isSoloed={track.soloed}
                    onVolumeChange={setTrackVolume}
                    onPanChange={setTrackPan}
                    onMuteToggle={toggleTrackMute}
                    onSoloToggle={toggleTrackSolo}
                />
            ))}
        </div>
    );
};
