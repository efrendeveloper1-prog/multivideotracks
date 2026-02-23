'use client';

import React, { useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { useAudioEngine, Song } from '@/hooks/useAudioEngine';

export const SongList: React.FC = () => {
    const {
        playlist,
        activeSongId,
        addSongToPlaylist,
        removeSongFromPlaylist,
        loadSong,
        addTrack,
        addVideoTrack,
        prepareSongCache,
        loadPreparedSong,
        loadingProgress
    } = useAudioEngine();
    const zipInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadMessage, setUploadMessage] = React.useState('');

    // Handle adding a new multitrack from ZIP
    const handleAddMultitrack = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setUploadMessage('Extrayendo ZIP...');

            const zip = new JSZip();
            const contents = await zip.loadAsync(file);

            const stemFiles: File[] = [];
            let videoFile: File | undefined;

            const promises: Promise<void>[] = [];

            contents.forEach((relativePath, fileEntry) => {
                if (fileEntry.dir) return;

                if (relativePath.match(/\.(wav|mp3)$/i)) {
                    promises.push(
                        fileEntry.async('blob').then(blob => {
                            const audioFile = new File([blob], relativePath.split('/').pop() || 'track', { type: blob.type || 'audio/mpeg' });
                            stemFiles.push(audioFile);
                        })
                    );
                } else if (relativePath.match(/\.(mp4|mov|webm|avi)$/i)) {
                    promises.push(
                        fileEntry.async('blob').then(blob => {
                            videoFile = new File([blob], relativePath.split('/').pop() || 'video', { type: blob.type || 'video/mp4' });
                        })
                    );
                }
            });

            await Promise.all(promises);

            setUploadMessage('Preparando tracks...');

            // Create song entry
            const songName = file.name.replace(/\.zip$/i, '');
            let newSong: Song = {
                id: crypto.randomUUID(),
                title: songName,
                artist: '',
                key: '',
                bpm: 0,
                stemFiles,
                videoFile
            };

            setUploadMessage('Decodificando audio (puede tardar un momento)...');
            // Decode and prepare memory tracks so it loads instantly when clicked
            newSong = await prepareSongCache(newSong);

            addSongToPlaylist(newSong);

            // If first song, auto-load it
            if (playlist.length === 0) {
                setUploadMessage('Cargando en reproductor...');
                loadPreparedSong(newSong);
            }
            setIsUploading(false);
        } catch (error) {
            console.error('Error processing ZIP:', error);
            alert('Error al leer el archivo ZIP.');
            setIsUploading(false);
        }

        event.target.value = '';
    }, [addSongToPlaylist, playlist.length, addTrack, addVideoTrack]);

    // Handle adding video separately
    const handleAddVideo = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setUploadMessage('Procesando video...');
        await addVideoTrack(file);
        setIsUploading(false);
        event.target.value = '';
    }, [addVideoTrack]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-900">
            {/* Header with title + upload buttons */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800 border-b border-gray-700">
                <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider">Playlist</span>
                <div className="flex items-center gap-1">
                    {/* Add Multitrack ZIP */}
                    <button
                        onClick={() => zipInputRef.current?.click()}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        title="Agregar multitrack (ZIP)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <input ref={zipInputRef} type="file" accept=".zip" onChange={handleAddMultitrack} className="hidden" />

                    {/* Add Video */}
                    <button
                        onClick={() => videoInputRef.current?.click()}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-purple-400 transition-colors"
                        title="Agregar video"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                    </button>
                    <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/*" onChange={handleAddVideo} className="hidden" />
                </div>
            </div>

            {/* Discrete Loading Indicator */}
            {isUploading && (
                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800/80 border-b border-gray-700/50">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                        <span className="text-[10px] text-gray-400 font-medium truncate">{uploadMessage}</span>
                    </div>
                    {loadingProgress !== null && (
                        <span className="text-[10px] font-bold text-green-400">{loadingProgress}%</span>
                    )}
                </div>
            )}

            {/* Song list */}
            <div className="flex-1 overflow-y-auto">
                {playlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 px-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 mb-2 text-gray-700">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                        </svg>
                        <p className="text-[11px] text-center">Carga un ZIP con stems para agregar canciones al playlist</p>
                    </div>
                ) : (
                    playlist.map((song, index) => (
                        <div
                            key={song.id}
                            onClick={async () => {
                                setIsUploading(true);
                                setUploadMessage('Cargando tracks...');
                                await loadSong(song.id);
                                setIsUploading(false);
                            }}
                            className={`
                                px-2 py-2 border-b border-gray-800 flex items-center cursor-pointer transition-all text-sm
                                ${activeSongId === song.id
                                    ? 'bg-green-900/30 border-l-2 border-l-green-500'
                                    : 'hover:bg-gray-800/80 border-l-2 border-l-transparent'
                                }
                            `}
                        >
                            <div className="w-5 text-[10px] font-bold text-gray-500 shrink-0">{index + 1}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-semibold truncate">{song.title}</div>
                                <div className="text-gray-500 text-[10px] truncate">
                                    {song.cachedTracks ? song.cachedTracks.filter(t => !t.name.includes('VIDEO') && !t.isVideoAudio).length : song.stemFiles.length} stems
                                    {(song.videoFile || (song.cachedTracks && song.cachedTracks.some(t => t.name.includes('VIDEO')))) ? ' + video' : ''}
                                </div>
                            </div>
                            {activeSongId === song.id && (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-1 shrink-0" />
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); removeSongFromPlaylist(song.id); }}
                                className="ml-1 p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors shrink-0"
                                title="Eliminar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
