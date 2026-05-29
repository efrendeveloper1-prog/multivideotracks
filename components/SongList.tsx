'use client';

import React, { useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { useAudioEngine, Song } from '@/hooks/useAudioEngine';

export const SongList: React.FC = () => {
    const {
        playlist,
        setPlaylist,
        activeSongId,
        addSongToPlaylist,
        removeSongFromPlaylist,
        updateSongInPlaylist,
        loadSong,
        addTrack,
        addVideoTrack,
        prepareSongCache,
        loadPreparedSong,
        loadingProgress,
        exportPreset,
        importPreset,
        isUploading,
        uploadMessage,
        processZipFile,
        processVideoFile
    } = useAudioEngine();
    const zipInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);


    // Updated input handlers
    const handleAddMultitrack = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processZipFile(file);
        event.target.value = '';
    }, [processZipFile]);

    const handleAddVideo = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processVideoFile(file);
        event.target.value = '';
    }, [processVideoFile]);

    // Drag and Drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (draggedIndex !== null) return;
        const types = e.dataTransfer.types;
        const isFileDrag = types && (types.includes ? types.includes('Files') : Array.from(types).includes('Files'));
        if (isFileDrag) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        }
    }, [draggedIndex]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        if (draggedIndex !== null) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, [draggedIndex]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        if (draggedIndex !== null) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        for (const file of files) {
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (extension === 'zip') {
                await processZipFile(file);
            } else if (['mp4', 'mov', 'webm', 'avi'].includes(extension || '')) {
                await processVideoFile(file);
            }
        }
    }, [draggedIndex, processZipFile, processVideoFile]);

    const handleAutoLocate = useCallback(async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker({
                mode: 'read'
            });

            const filesToProcess: File[] = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.match(/\.(zip)$/i)) {
                    filesToProcess.push(await entry.getFile());
                }
            }

            const missingSongs = playlist.filter(s => s.isPlaceholder);
            
            // Mark all missing songs as 'searching' initially (or 'not_found' if ZIP isn't there)
            setPlaylist(prev => prev.map(s => {
                if (s.isPlaceholder) {
                    const hasZip = filesToProcess.some(f => f.name.toLowerCase() === `${s.title.toLowerCase()}.zip`);
                    return {
                        ...s,
                        locateStatus: hasZip ? 'pending' : 'not_found',
                        locateProgress: 0
                    };
                }
                return s;
            }));

            for (const missingSong of missingSongs) {
                const matchingZip = filesToProcess.find(f => f.name.toLowerCase() === `${missingSong.title.toLowerCase()}.zip`);
                if (!matchingZip) continue;

                // Mark as unzipping
                setPlaylist(prev => prev.map(s => s.id === missingSong.id ? { ...s, locateStatus: 'unzipping', locateProgress: 0 } : s));

                const zip = new JSZip();
                const contents = await zip.loadAsync(matchingZip);
                
                const stemFiles: File[] = [];
                let videoFile: File | undefined;
                const promises: Promise<void>[] = [];

                // Filter files inside ZIP to extract
                const entriesToExtract = Object.keys(contents.files).filter(relativePath => {
                    const fileEntry = contents.files[relativePath];
                    return !fileEntry.dir && !!relativePath.match(/\.(wav|mp3|mp4|mov|webm|avi)$/i);
                });
                const totalFiles = entriesToExtract.length;
                let completedFilesCount = 0;

                const updateUnzipProgress = () => {
                    completedFilesCount++;
                    const progress = totalFiles > 0 ? Math.round((completedFilesCount / totalFiles) * 40) : 40;
                    setPlaylist(prev => prev.map(s => s.id === missingSong.id ? { ...s, locateStatus: 'unzipping', locateProgress: progress } : s));
                };

                for (const relativePath of entriesToExtract) {
                    const fileEntry = contents.files[relativePath];
                    if (relativePath.match(/\.(wav|mp3)$/i)) {
                        promises.push(
                            fileEntry.async('blob').then(blob => {
                                stemFiles.push(new File([blob], relativePath.split('/').pop() || 'track', { type: blob.type || 'audio/mpeg' }));
                                updateUnzipProgress();
                            })
                        );
                    } else if (relativePath.match(/\.(mp4|mov|webm|avi)$/i)) {
                        promises.push(
                            fileEntry.async('blob').then(blob => {
                                videoFile = new File([blob], relativePath.split('/').pop() || 'video', { type: blob.type || 'video/mp4' });
                                updateUnzipProgress();
                            })
                        );
                    }
                }

                await Promise.all(promises);

                // Prepare cache (decoding + audio analysis)
                let updatedSong: Song = { 
                    ...missingSong, 
                    stemFiles, 
                    videoFile,
                    locateStatus: 'decoding',
                    locateProgress: 40
                };

                updatedSong = await prepareSongCache(updatedSong, missingSong, (pct) => {
                    const scaledProgress = Math.round(40 + (pct * 0.6));
                    setPlaylist(prev => prev.map(s => s.id === missingSong.id ? { ...s, locateStatus: 'decoding', locateProgress: scaledProgress } : s));
                });

                // Clear temporary progress properties from final cached song
                const { locateProgress, locateStatus, ...finalSong } = updatedSong;
                updateSongInPlaylist(missingSong.id, finalSong as Song);
            }

        } catch (error) {
            console.error(error);
        }
    }, [playlist, setPlaylist, prepareSongCache, updateSongInPlaylist]);
    // Handle importing preset
    const handleImportPreset = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await importPreset(file);
        event.target.value = '';
    }, [importPreset]);

    // Playlist reordering drag-and-drop handlers
    const dragOccurredRef = useRef(false);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        dragOccurredRef.current = false;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOverItem = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        dragOccurredRef.current = true;
        
        setPlaylist(prev => {
            const next = [...prev];
            const [draggedItem] = next.splice(draggedIndex, 1);
            next.splice(index, 0, draggedItem);
            return next;
        });
        setDraggedIndex(index);
    }, [draggedIndex, setPlaylist]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);


    return (
        <div
            className={`w-full h-full flex flex-col bg-gray-900 relative transition-colors duration-200 ${isDragging ? 'bg-gray-800 ring-2 ring-inset ring-green-500/50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay Feedback */}
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-500/10 pointer-events-none border-2 border-dashed border-green-500/40 m-2 rounded-lg">
                    <div className="flex flex-col items-center gap-2 bg-gray-900/90 px-6 py-4 rounded-xl shadow-2xl border border-green-500/30">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-.53 14.03a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72V8.25a.75.75 0 00-1.5 0v5.69l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Suelta para cargar</span>
                        <span className="text-[11px] text-gray-400 font-medium">Archivos ZIP o Video</span>
                    </div>
                </div>
            )}
            {/* Header with title + upload buttons */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800 border-b border-gray-700">
                <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider">Playlist</span>
                <div className="flex items-center gap-1">
                    {/* Cargar Preset */}
                    <button
                        onClick={() => presetInputRef.current?.click()}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-blue-400 transition-colors"
                        title="Cargar Preset (.json)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <input ref={presetInputRef} type="file" accept=".json" onChange={handleImportPreset} className="hidden" />

                    {/* Guardar Preset */}
                    <button
                        onClick={exportPreset}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-blue-400 transition-colors"
                        title="Guardar Preset (.json)"
                        disabled={playlist.length === 0}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>

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
                    <input id="zip-upload-input" ref={zipInputRef} type="file" accept=".zip" onChange={handleAddMultitrack} className="hidden" />

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

            {/* Error Banner for Missing Tracks */}
            {playlist.some(s => s.isPlaceholder) && !isUploading && (
                <div className="bg-orange-900/60 border-b border-orange-700/50 p-2 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-orange-300 text-[10px] sm:text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span>Faltan archivos de audio/video.</span>
                    </div>
                    <button
                        onClick={handleAutoLocate}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap shadow-sm shadow-orange-900/50"
                    >
                        Auto-Localizar Carpeta
                    </button>
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
                            draggable={!isUploading}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOverItem(e, index)}
                            onDragEnd={handleDragEnd}
                            onClick={async () => {
                                if (dragOccurredRef.current) return;
                                if (song.isPlaceholder) {
                                    if (song.locateStatus && song.locateStatus !== 'not_found') {
                                        return;
                                    }
                                    alert(`Sube el archivo ZIP de "${song.title}" (mismo nombre) para cargarlo.`);
                                    return;
                                }
                                await loadSong(song.id);
                            }}
                            className={`
                                px-2 py-2 flex items-center cursor-pointer transition-all text-sm group select-none
                                ${song.isPlaceholder
                                    ? (song.locateStatus === 'not_found'
                                        ? 'opacity-70 border-l-2 border-l-red-500/50 bg-red-950/5'
                                        : song.locateStatus
                                            ? 'opacity-95 border-l-2 border-l-blue-500/50 bg-blue-950/10'
                                            : 'opacity-60 border-l-2 border-l-orange-500/50')
                                    : ''
                                }
                                ${activeSongId === song.id
                                    ? 'bg-green-900/30 border-l-2 border-l-green-500'
                                    : 'hover:bg-gray-800/80 border-l-2 border-l-transparent'
                                }
                                ${draggedIndex === index
                                    ? 'opacity-30 bg-green-500/10 border-y border-dashed border-green-500/60'
                                    : 'border-b border-gray-800'
                                }
                            `}
                        >
                            <div className="w-5 text-[10px] font-bold text-gray-500 shrink-0 flex items-center justify-start">
                                <span className="group-hover:hidden">{index + 1}</span>
                                <span className="hidden group-hover:inline-block text-gray-400 cursor-grab active:cursor-grabbing">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                        <circle cx="9" cy="12" r="1" fill="currentColor" />
                                        <circle cx="9" cy="5" r="1" fill="currentColor" />
                                        <circle cx="9" cy="19" r="1" fill="currentColor" />
                                        <circle cx="15" cy="12" r="1" fill="currentColor" />
                                        <circle cx="15" cy="5" r="1" fill="currentColor" />
                                        <circle cx="15" cy="19" r="1" fill="currentColor" />
                                    </svg>
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-semibold truncate">{song.title}</div>
                                <div className="text-gray-500 text-[10px] truncate">
                                    {song.isPlaceholder ? (
                                        song.locateStatus ? (
                                            <div className="flex flex-col gap-1 mt-1">
                                                <div className="flex items-center justify-between text-[10px] font-medium">
                                                    {song.locateStatus === 'pending' && <span className="text-yellow-400">🔍 Buscando ZIP...</span>}
                                                    {song.locateStatus === 'unzipping' && <span className="text-blue-400">📦 Extrayendo ZIP...</span>}
                                                    {song.locateStatus === 'decoding' && <span className="text-purple-400 animate-pulse font-semibold">⚙️ Decodificando...</span>}
                                                    {song.locateStatus === 'not_found' && <span className="text-red-400 font-medium">❌ ZIP no encontrado</span>}
                                                    {song.locateProgress !== undefined && song.locateProgress > 0 && (
                                                        <span className="text-green-400 font-bold ml-1">{song.locateProgress}%</span>
                                                    )}
                                                </div>
                                                {song.locateProgress !== undefined && song.locateProgress > 0 && (
                                                    <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden mt-0.5">
                                                        <div 
                                                            className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full transition-all duration-300"
                                                            style={{ width: `${song.locateProgress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-orange-400">⚠️ Falta archivo ZIP</span>
                                        )
                                    ) : (
                                        <>
                                            {song.cachedTracks ? song.cachedTracks.filter(t => !t.name.includes('VIDEO') && !t.isVideoAudio).length : song.stemFiles.length} stems
                                            {(song.videoFile || (song.cachedTracks && song.cachedTracks.some(t => t.name.includes('VIDEO')))) ? ' + video' : ''}
                                        </>
                                    )}
                                </div>
                            </div>
                            {activeSongId === song.id && !song.isPlaceholder && (
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
