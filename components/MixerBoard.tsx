import React from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { MixerChannel } from './MixerChannel';

export const MixerBoard: React.FC = () => {
    const {
        tracks,
        setTrackVolume,
        setTrackPan,
        toggleTrackMute,
        toggleTrackSolo,
        isUploading,
        setIsUploading,
        uploadMessage,
        setUploadMessage,
        processZipFile,
        processVideoFile
    } = useAudioEngine();

    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Process first zip or first video found
        const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
        const videoFile = files.find(f => f.name.toLowerCase().match(/\.(mp4|mov|webm|avi)$/i));

        if (zipFile) {
            await processZipFile(zipFile);
        } else if (videoFile) {
            await processVideoFile(videoFile);
        }
    };

    return (
        <div className="flex flex-row h-full overflow-x-auto items-stretch pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900">
            {tracks.length === 0 && (
                <div 
                    className={`text-gray-500 w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg m-4 transition-colors ${isDragging ? 'border-green-500 bg-green-500/5 text-green-400' : 'border-gray-700 bg-gray-900/50'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className={`p-4 rounded-full bg-gray-800 shadow-xl border ${isDragging ? 'border-green-500/50 text-green-400 scale-110' : 'border-gray-700 text-gray-500'} transition-all duration-200`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                                <path fillRule="evenodd" d="M10.5 3.75a6 6 0 0 0-5.98 6.496A5.25 5.25 0 0 0 6.75 20.25H18a4.5 4.5 0 0 0 1.106-8.866 5.25 5.25 0 0 0-8.606-7.634Z" clipRule="evenodd" />
                                <path d="M11.47 13.28a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06l-1.72-1.72V19a.75.75 0 0 1-1.5 0v-3.38l-1.72 1.72a.75.75 0 0 1-1.06-1.06l3-3Z" />
                            </svg>
                        </div>
                        
                        <div className="text-center">
                            <h3 className={`text-lg font-bold mb-1 ${isDragging ? 'text-green-400' : 'text-gray-300'}`}>
                                {isDragging ? '¡Suéltalo aquí!' : 'Carga un multitrack'}
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Arrastra un archivo ZIP o Video directamente aquí
                            </p>
                        </div>

                        <button
                            onClick={() => document.getElementById('zip-upload-input')?.click()}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clipRule="evenodd" />
                            </svg>
                            Seleccionar Archivo
                        </button>
                    </div>
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
