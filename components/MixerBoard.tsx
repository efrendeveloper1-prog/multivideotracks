import React from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { MixerChannel } from './MixerChannel';

export const MixerBoard: React.FC = () => {
    const {
        tracks,
        setTrackVolume,
        toggleTrackMute,
        toggleTrackSolo
    } = useAudioEngine();

    return (
        <div className="flex flex-row h-full overflow-x-auto items-stretch pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900">
            {tracks.length === 0 && (
                <div className="text-gray-500 w-full h-full flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg m-4">
                    <span className="bg-gray-800 px-4 py-2 rounded">Carga un multitrack para empezar</span>
                </div>
            )}

            {tracks.map((track) => (
                <MixerChannel
                    key={track.id}
                    trackId={track.id}
                    name={track.name}
                    volume={track.volume}
                    isMuted={track.muted}
                    isSoloed={track.soloed}
                    onVolumeChange={setTrackVolume}
                    onMuteToggle={toggleTrackMute}
                    onSoloToggle={toggleTrackSolo}
                />
            ))}
        </div>
    );
};
