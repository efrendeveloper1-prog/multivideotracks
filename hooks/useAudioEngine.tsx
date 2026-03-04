import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { analyzeAudio, AudioAnalysis } from '@/utils/audioAnalysis';

// Types
export interface Track {
    id: string;
    name: string;
    file: File | null;
    buffer?: AudioBuffer;
    volume: number;
    muted: boolean;
    soloed: boolean;
    color: string;
    isVideoAudio?: boolean; // Flag for the extracted audio from video
    pan: number; // -1 to 1, Left to Right
}

export interface Song {
    id: string;
    title: string;
    artist: string;
    key: string;
    bpm: number;
    stemFiles: File[];
    videoFile?: File | null;
    cachedTracks?: Track[];
    cachedDuration?: number;
    cachedVideoDuration?: number;
    cachedVideoOffset?: number;
    isPlaceholder?: boolean;
    analysis?: AudioAnalysis | null;
}

interface AudioEngineContextType {
    tracks: Track[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    addTrack: (file: File, name: string) => Promise<void>;
    addVideoTrack: (file: File) => Promise<void>;
    removeTrack: (id: string) => void;
    clearTracks: () => void;
    togglePlay: () => void;
    stop: () => void;
    seek: (time: number) => void;
    setTrackVolume: (id: string, volume: number) => void;
    setTrackPan: (id: string, pan: number) => void;
    toggleTrackMute: (id: string) => void;
    toggleTrackSolo: (id: string) => void;
    setVideoElement: (element: HTMLVideoElement | null) => void;
    masterVolume: number;
    setMasterVolume: (val: number) => void;
    videoDuration: number; // Original video duration (may be longer than audio)
    trimVideoToAudio: () => void; // Trim video to match audio duration
    videoOffset: number; // Horizontal offset in seconds for video sync
    setVideoOffset: (offset: number) => void;
    // Playlist
    playlist: Song[];
    activeSongId: string | null;
    addSongToPlaylist: (song: Song) => void;
    removeSongFromPlaylist: (id: string) => void;
    updateSongInPlaylist: (id: string, song: Song) => void;
    loadSong: (id: string) => Promise<void>;
    loadPreparedSong: (song: Song) => void;
    updateActiveSongCache: () => void;
    prepareSongCache: (song: Song, placeholderSettings?: Song) => Promise<Song>;
    // Preset
    exportPreset: () => void;
    importPreset: (file: File) => Promise<void>;
    // Audio analysis
    songAnalysis: AudioAnalysis | null;
    loadingProgress: number | null;
    getMasterLevels: () => [number, number];
    getTrackLevel: (id: string) => number;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

export const useAudioEngine = () => {
    const context = useContext(AudioEngineContext);
    if (!context) throw new Error('useAudioEngine must be used within AudioEngineProvider');
    return context;
};

export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [masterVolume, setMasterVolume] = useState(1);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoOffset, setVideoOffset] = useState(0); // seconds offset for video sync
    const [playlist, setPlaylist] = useState<Song[]>([]);
    const [activeSongId, setActiveSongId] = useState<string | null>(null);
    const [songAnalysis, setSongAnalysis] = useState<AudioAnalysis | null>(null);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
    const pannerNodesRef = useRef<Map<string, StereoPannerNode>>(new Map());
    const masterGainRef = useRef<GainNode | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();
    const durationRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const videoOffsetRef = useRef<number>(0);
    const tracksRef = useRef<Track[]>([]);
    const videoDurationRef = useRef<number>(0);
    const activeSongIdRef = useRef<string | null>(null);
    const songAnalysisRef = useRef<AudioAnalysis | null>(null);
    const analysersRef = useRef<{ left: AnalyserNode, right: AnalyserNode } | null>(null);
    const trackAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());

    // Initialize AudioContext
    useEffect(() => {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);

        const splitter = audioContextRef.current.createChannelSplitter(2);
        masterGainRef.current.connect(splitter);

        const analyserL = audioContextRef.current.createAnalyser();
        analyserL.fftSize = 512;
        const analyserR = audioContextRef.current.createAnalyser();
        analyserR.fftSize = 512;

        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        analysersRef.current = { left: analyserL, right: analyserR };

        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    // Keep refs in sync with state
    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { videoOffsetRef.current = videoOffset; }, [videoOffset]);
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);
    useEffect(() => { videoDurationRef.current = videoDuration; }, [videoDuration]);
    useEffect(() => { activeSongIdRef.current = activeSongId; }, [activeSongId]);
    useEffect(() => { songAnalysisRef.current = songAnalysis; }, [songAnalysis]);

    // Master Volume Effect
    useEffect(() => {
        if (masterGainRef.current) {
            masterGainRef.current.gain.value = masterVolume;
        }
    }, [masterVolume]);

    // Color helper
    const getTrackColor = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drum') || n.includes('bateria')) return '#06b6d4';
        if (n.includes('bass') || n.includes('bajo')) return '#0d9488';
        if (n.includes('vox') || n.includes('voz') || n.includes('vocal')) return '#2563eb';
        if (n.includes('click')) return '#dc2626';
        if (n.includes('key') || n.includes('piano') || n.includes('synth')) return '#d946ef';
        if (n.includes('guitar') || n.includes('guit')) return '#f59e0b';
        if (n.includes('video')) return '#a855f7';
        return '#94a3b8';
    };

    const addTrack = useCallback(async (file: File, name: string) => {
        if (!audioContextRef.current) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            const newTrack: Track = {
                id: crypto.randomUUID(),
                name,
                file,
                buffer: audioBuffer,
                volume: 1,
                pan: name.toLowerCase().includes('click') || name.toLowerCase().includes('guia') || name.toLowerCase().includes('guide') ? -1 : 0,
                muted: false,
                soloed: false,
                color: getTrackColor(name)
            };

            setTracks(prev => [...prev, newTrack]);
            setDuration(prev => Math.max(prev, audioBuffer.duration));

            // Run audio analysis on first audio track
            if (!songAnalysis) {
                analyzeAudio(audioBuffer).then(result => {
                    setSongAnalysis(result);
                }).catch(e => console.warn('Audio analysis failed:', e));
            }
        } catch (e) {
            console.error("Error decoding audio", e);
        }
    }, []);

    const addVideoTrack = useCallback(async (videoFile: File) => {
        if (!audioContextRef.current) return;

        const url = URL.createObjectURL(videoFile);

        let oldVidTrack: Track | undefined;
        let oldVidAudioTrack: Track | undefined;

        // Find existing video tracks in current state to inherit settings
        const currentTracks = tracksRef.current;
        oldVidTrack = currentTracks.find(t => t.name === "VIDEO TRACK");
        oldVidAudioTrack = currentTracks.find(t => t.isVideoAudio);

        // 1. Create the visual VIDEO TRACK (no buffer, for timeline thumbnails)
        const videoTrack: Track = {
            id: oldVidTrack ? oldVidTrack.id : crypto.randomUUID(),
            name: "VIDEO TRACK",
            file: videoFile,
            buffer: undefined,
            volume: oldVidTrack ? oldVidTrack.volume : 1,
            pan: oldVidTrack ? oldVidTrack.pan : 0,
            muted: oldVidTrack ? oldVidTrack.muted : false,
            soloed: oldVidTrack ? oldVidTrack.soloed : false,
            color: '#a855f7'
        };

        // 2. Try to extract audio from video and create a separate audio channel
        let audioTrack: Track | null = null;
        try {
            const arrayBuffer = await videoFile.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));

            audioTrack = {
                id: oldVidAudioTrack ? oldVidAudioTrack.id : crypto.randomUUID(),
                name: "VIDEO AUDIO",
                file: videoFile,
                buffer: audioBuffer,
                volume: oldVidAudioTrack ? oldVidAudioTrack.volume : 1,
                pan: oldVidAudioTrack ? oldVidAudioTrack.pan : 0,
                muted: oldVidAudioTrack ? oldVidAudioTrack.muted : false,
                soloed: oldVidAudioTrack ? oldVidAudioTrack.soloed : false,
                color: '#c084fc',
                isVideoAudio: true
            };
        } catch (e) {
            console.warn("Video has no extractable audio or decode failed:", e);
        }

        // Apply immediately to tracks state
        setTracks(prev => {
            const filtered = prev.filter(t => t.name !== "VIDEO TRACK" && !t.isVideoAudio);
            const newTracks = [...filtered, videoTrack];
            if (audioTrack) newTracks.push(audioTrack);
            return newTracks;
        });

        // Get video duration
        let newVideoDuration = 0;
        const tempVideo = document.createElement('video');
        tempVideo.src = url;

        // Wrap the onloadedmetadata in a promise since we need the duration to update caches
        const durationPromise = new Promise<number>((resolve) => {
            tempVideo.onloadedmetadata = () => {
                newVideoDuration = tempVideo.duration;
                setVideoDuration(tempVideo.duration);
                // Only use video duration if there are NO audio tracks yet
                setDuration(prev => {
                    if (prev === 0) return tempVideo.duration; // No audio, use video duration
                    return prev; // Audio exists, keep audio duration as master
                });
                resolve(newVideoDuration);
            };
            tempVideo.onerror = () => {
                resolve(0);
            }
        });

        const duration = await durationPromise;

        // Store videoFile in the active song
        if (activeSongIdRef.current) {
            setPlaylist(prev => prev.map(s => {
                if (s.id === activeSongIdRef.current) {
                    const filteredCached = (s.cachedTracks || []).filter(t => t.name !== "VIDEO TRACK" && !t.isVideoAudio);
                    const newCachedTracks = [...filteredCached, videoTrack];
                    if (audioTrack) {
                        newCachedTracks.push(audioTrack);
                    }

                    return {
                        ...s,
                        videoFile,
                        cachedTracks: newCachedTracks,
                        cachedVideoDuration: duration,
                    };
                }
                return s;
            }));
        }
    }, []);

    const clearTracks = useCallback(() => {
        stopAudioInternal();
        setTracks([]);
        setDuration(0);
        setVideoDuration(0);
        setCurrentTime(0);
        setSongAnalysis(null);
        pauseTimeRef.current = 0;
        setIsPlaying(false);
    }, []);

    const stopAudioInternal = () => {
        sourceNodesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourceNodesRef.current.clear();
        gainNodesRef.current.clear();
        pannerNodesRef.current.clear();
        trackAnalysersRef.current.clear();
    };

    const playAudio = useCallback((startOffset: number) => {
        if (!audioContextRef.current || !masterGainRef.current) return;

        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        const anySolo = tracks.some(t => t.soloed);

        tracks.forEach(track => {
            if (!track.buffer) return; // Skip VIDEO TRACK (no buffer)

            const source = audioContextRef.current!.createBufferSource();
            source.buffer = track.buffer;

            const gainNode = audioContextRef.current!.createGain();
            const shouldLogicallyMute = track.muted || (anySolo && !track.soloed);
            gainNode.gain.value = shouldLogicallyMute ? 0 : track.volume;

            const pannerNode = audioContextRef.current!.createStereoPanner();
            pannerNode.pan.value = track.pan !== undefined ? track.pan : 0;

            const analyserNode = audioContextRef.current!.createAnalyser();
            analyserNode.fftSize = 256;

            source.connect(gainNode);
            gainNode.connect(analyserNode);
            analyserNode.connect(pannerNode);
            pannerNode.connect(masterGainRef.current!);
            let trackWhen = 0;
            let trackOffset = startOffset;

            if (track.isVideoAudio) {
                const offsetSum = startOffset + videoOffsetRef.current;
                if (offsetSum >= 0) {
                    trackOffset = offsetSum;
                } else {
                    trackWhen = audioContextRef.current!.currentTime + Math.abs(offsetSum);
                    trackOffset = 0;
                }
            }

            try {
                source.start(trackWhen, trackOffset);
            } catch (e) {
                console.warn("Error starting source", e);
            }

            sourceNodesRef.current.set(track.id, source);
            gainNodesRef.current.set(track.id, gainNode);
            pannerNodesRef.current.set(track.id, pannerNode);
            trackAnalysersRef.current.set(track.id, analyserNode);

            source.onended = () => { };
        });
    }, [tracks]);

    const stopAudio = useCallback(() => {
        stopAudioInternal();
    }, []);

    const togglePlay = useCallback(() => {
        if (isPlayingRef.current) {
            stopAudioInternal();
            pauseTimeRef.current = currentTime;
            if (videoRef.current) videoRef.current.pause();
            cancelAnimationFrame(animationFrameRef.current!);
            setIsPlaying(false);
            isPlayingRef.current = false;
        } else {
            let start = pauseTimeRef.current;
            if (start >= durationRef.current && durationRef.current > 0) {
                start = 0;
                pauseTimeRef.current = 0;
            }

            playAudio(start);
            startTimeRef.current = audioContextRef.current!.currentTime - start;

            if (videoRef.current) {
                const videoStartOffset = start + videoOffsetRef.current;
                if (videoStartOffset >= 0) {
                    videoRef.current.currentTime = videoStartOffset;
                    videoRef.current.play().catch(e => console.error("Video play failed", e));
                } else {
                    videoRef.current.currentTime = 0;
                    // Don't play yet, wait for update loop
                }
            }

            setIsPlaying(true);
            isPlayingRef.current = true;

            const update = () => {
                if (!isPlayingRef.current) return; // Guard: if stopped externally

                const now = audioContextRef.current?.currentTime;
                if (now === undefined) return;
                const calculatedTime = now - startTimeRef.current;
                const dur = durationRef.current;

                if (videoRef.current && videoRef.current.paused && isPlayingRef.current) {
                    const videoStartOffset = calculatedTime + videoOffsetRef.current;
                    if (videoStartOffset >= 0) {
                        videoRef.current.currentTime = videoStartOffset;
                        videoRef.current.play().catch(e => console.error("Delayed video play failed", e));
                    }
                }

                if (calculatedTime >= dur && dur > 0) {
                    // Song ended — stop everything
                    stopAudioInternal();
                    if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.currentTime = Math.max(0, videoOffsetRef.current);
                    }
                    pauseTimeRef.current = 0;
                    setCurrentTime(0);
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    return;
                }

                setCurrentTime(calculatedTime);
                animationFrameRef.current = requestAnimationFrame(update);
            };
            animationFrameRef.current = requestAnimationFrame(update);
        }
    }, [currentTime, playAudio]);

    const stop = useCallback(() => {
        stopAudioInternal();
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = Math.max(0, videoOffsetRef.current);
        }
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        cancelAnimationFrame(animationFrameRef.current!);
    }, []);

    const seek = useCallback((time: number) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) stopAudioInternal();

        pauseTimeRef.current = time;
        setCurrentTime(time);

        if (videoRef.current) {
            const videoStartOffset = time + videoOffsetRef.current;
            if (videoStartOffset >= 0) {
                videoRef.current.currentTime = videoStartOffset;
            } else {
                videoRef.current.currentTime = 0;
                if (wasPlaying) videoRef.current.pause();
            }
        }

        if (wasPlaying) {
            playAudio(time);
            startTimeRef.current = audioContextRef.current!.currentTime - time;
            if (videoRef.current && (time + videoOffsetRef.current) >= 0) {
                videoRef.current.play().catch(e => console.error("Seek play failed", e));
            }
        }
    }, [isPlaying, playAudio]);

    // Live Volume/Mute/Solo updates
    useEffect(() => {
        const anySolo = tracks.some(t => t.soloed);

        tracks.forEach(track => {
            const shouldLogicallyMute = track.muted || (anySolo && !track.soloed);
            const targetVolume = shouldLogicallyMute ? 0 : track.volume;

            if (track.name === "VIDEO TRACK" && videoRef.current) {
                videoRef.current.volume = targetVolume * masterVolume;
                videoRef.current.muted = shouldLogicallyMute;
            } else {
                const gainNode = gainNodesRef.current.get(track.id);
                if (gainNode && audioContextRef.current) {
                    gainNode.gain.cancelScheduledValues(audioContextRef.current.currentTime);
                    gainNode.gain.setTargetAtTime(targetVolume, audioContextRef.current.currentTime, 0.05);
                }
            }

            const pannerNode = pannerNodesRef.current.get(track.id);
            if (pannerNode && audioContextRef.current && track.pan !== undefined) {
                pannerNode.pan.setTargetAtTime(track.pan, audioContextRef.current.currentTime, 0.05);
            }
        });
    }, [tracks, masterVolume]);

    const setTrackVolume = (id: string, volume: number) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, volume } : t));
    };

    const setTrackPan = (id: string, pan: number) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, pan } : t));
    };

    const toggleTrackMute = (id: string) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
    };

    const toggleTrackSolo = (id: string) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, soloed: !t.soloed } : t));
    };

    const removeTrack = (id: string) => {
        setTracks(prev => prev.filter(t => t.id !== id));
    };

    // Trim video to match audio duration
    const trimVideoToAudio = useCallback(() => {
        // Recalculate duration based only on audio tracks
        const audioTracks = tracks.filter(t => t.buffer && !t.name.includes("VIDEO"));
        if (audioTracks.length > 0) {
            const audioDur = Math.max(...audioTracks.map(t => t.buffer!.duration));
            setDuration(audioDur);
        }
    }, [tracks]);

    // Playlist management
    const prepareSongCache = useCallback(async (song: Song, placeholderSettings?: Song): Promise<Song> => {
        if (!audioContextRef.current) return song;

        const newTracks: Track[] = [];
        let newDuration = 0;
        let loadedItems = 0;
        const totalItems = song.stemFiles.length + (song.videoFile ? 2 : 0);
        setLoadingProgress(0);

        let newAnalysis = placeholderSettings?.analysis || song.analysis || null;

        // Decode audio stems
        for (const file of song.stemFiles) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                const name = file.name.replace(/\.(wav|mp3)$/i, '');
                const oldT = placeholderSettings?.cachedTracks?.find(t => t.name === name);

                if (!newAnalysis || newAnalysis.bpm === 0) {
                    try {
                        const analysis = await analyzeAudio(audioBuffer);
                        if (!newAnalysis) {
                            newAnalysis = analysis;
                        } else if (analysis.bpm > 0) {
                            newAnalysis.bpm = analysis.bpm;
                        }
                    } catch (e) {
                        console.warn('Analysis failed for track:', name, e);
                    }
                }

                newTracks.push({
                    id: crypto.randomUUID(),
                    name,
                    file,
                    buffer: audioBuffer,
                    volume: oldT ? oldT.volume : 1,
                    pan: oldT ? oldT.pan : (name.toLowerCase().includes('click') || name.toLowerCase().includes('guia') || name.toLowerCase().includes('guide') ? -1 : 0),
                    muted: oldT ? oldT.muted : false,
                    soloed: oldT ? oldT.soloed : false,
                    color: getTrackColor(name)
                });
                newDuration = Math.max(newDuration, audioBuffer.duration);
            } catch (e) {
                console.error("Error decoding stem", e);
            }
            loadedItems++;
            setLoadingProgress(Math.round((loadedItems / totalItems) * 100));
        }

        let newVideoDuration = 0;
        if (song.videoFile) {
            const url = URL.createObjectURL(song.videoFile);
            const tempVideo = document.createElement('video');
            tempVideo.src = url;
            newVideoDuration = await new Promise<number>((resolve) => {
                tempVideo.onloadedmetadata = () => resolve(tempVideo.duration);
                tempVideo.onerror = () => resolve(0);
            });

            const oldVid = placeholderSettings?.cachedTracks?.find(t => t.name === "VIDEO TRACK");
            newTracks.push({
                id: crypto.randomUUID(),
                name: "VIDEO TRACK",
                file: song.videoFile,
                buffer: undefined,
                volume: oldVid ? oldVid.volume : 1,
                pan: oldVid ? oldVid.pan : 0,
                muted: oldVid ? oldVid.muted : false,
                soloed: oldVid ? oldVid.soloed : false,
                color: '#a855f7'
            });

            loadedItems++;
            setLoadingProgress(Math.round((loadedItems / totalItems) * 100));

            try {
                const arrayBuffer = await song.videoFile.arrayBuffer();
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));

                const oldAudio = placeholderSettings?.cachedTracks?.find(t => t.isVideoAudio);
                newTracks.push({
                    id: crypto.randomUUID(),
                    name: "VIDEO AUDIO",
                    file: song.videoFile,
                    buffer: audioBuffer,
                    volume: oldAudio ? oldAudio.volume : 1,
                    pan: oldAudio ? oldAudio.pan : 0,
                    muted: oldAudio ? oldAudio.muted : false,
                    soloed: oldAudio ? oldAudio.soloed : false,
                    color: '#c084fc',
                    isVideoAudio: true
                });
            } catch (e) {
                console.warn("Video audio extraction failed", e);
            }
            loadedItems++;
            setLoadingProgress(Math.round((loadedItems / totalItems) * 100));
        } else if (placeholderSettings?.cachedTracks) {
            // Restore placeholder video tracks if zip did not contain video
            const oldVid = placeholderSettings.cachedTracks.find(t => t.name === "VIDEO TRACK");
            if (oldVid) newTracks.push(oldVid);

            const oldAudio = placeholderSettings.cachedTracks.find(t => t.isVideoAudio);
            if (oldAudio) newTracks.push(oldAudio);
        }

        setLoadingProgress(null);

        return {
            ...song,
            cachedTracks: newTracks,
            cachedDuration: placeholderSettings?.cachedDuration || newDuration || newVideoDuration,
            cachedVideoDuration: placeholderSettings?.cachedVideoDuration || newVideoDuration,
            cachedVideoOffset: placeholderSettings?.cachedVideoOffset || 0,
            isPlaceholder: false,
            analysis: newAnalysis
        };
    }, []);

    const addSongToPlaylist = useCallback((song: Song) => {
        setPlaylist(prev => [...prev, song]);
    }, []);

    const removeSongFromPlaylist = useCallback((id: string) => {
        setPlaylist(prev => prev.filter(s => s.id !== id));
    }, []);

    const updateSongInPlaylist = useCallback((id: string, song: Song) => {
        setPlaylist(prev => prev.map(s => s.id === id ? song : s));
    }, []);

    const updateActiveSongCache = useCallback(() => {
        if (activeSongIdRef.current) {
            setPlaylist(prev => prev.map(s => {
                if (s.id === activeSongIdRef.current) {
                    return {
                        ...s,
                        cachedTracks: tracksRef.current,
                        cachedDuration: durationRef.current,
                        cachedVideoDuration: videoDurationRef.current,
                        cachedVideoOffset: videoOffsetRef.current,
                        analysis: songAnalysisRef.current
                    };
                }
                return s;
            }));
        }
    }, []);

    const loadSong = useCallback(async (id: string) => {
        const song = playlist.find(s => s.id === id);
        if (!song) return;

        // Save current state to the active song before switching
        updateActiveSongCache();

        // Stop current playback and clear tracks
        stopAudioInternal();
        cancelAnimationFrame(animationFrameRef.current!);
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        setActiveSongId(id);

        if (song.cachedTracks && song.cachedTracks.length > 0) {
            // Restore from cache
            setTracks(song.cachedTracks);
            setDuration(song.cachedDuration || 0);
            setVideoDuration(song.cachedVideoDuration || 0);
            setVideoOffset(song.cachedVideoOffset || 0);
            setSongAnalysis(song.analysis || null);
        } else {
            // Fresh load
            setDuration(0);
            setTracks([]);
            setVideoDuration(0);
            setVideoOffset(0);
            setSongAnalysis(null);

            let loadedItems = 0;
            const totalItems = song.stemFiles.length + (song.videoFile ? 2 : 0);
            setLoadingProgress(0);

            // Load all stem files
            for (const stemFile of song.stemFiles) {
                const trackName = stemFile.name.replace(/\.(wav|mp3)$/i, '');
                await addTrack(stemFile, trackName);
                loadedItems++;
                setLoadingProgress(Math.round((loadedItems / totalItems) * 100));
            }

            // Load video if present
            if (song.videoFile) {
                await addVideoTrack(song.videoFile);
                loadedItems += 2;
                setLoadingProgress(Math.round((loadedItems / totalItems) * 100));
            }
            setLoadingProgress(null);
        }
    }, [playlist, addTrack, addVideoTrack, updateActiveSongCache]);

    const loadPreparedSong = useCallback((song: Song) => {
        updateActiveSongCache();
        stopAudioInternal();
        cancelAnimationFrame(animationFrameRef.current!);
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        setActiveSongId(song.id);

        setTracks(song.cachedTracks || []);
        setDuration(song.cachedDuration || 0);
        setVideoDuration(song.cachedVideoDuration || 0);
        setVideoOffset(song.cachedVideoOffset || 0);
        setSongAnalysis(song.analysis || null);
    }, [updateActiveSongCache]);

    const exportPreset = useCallback(() => {
        // Prepare current state
        const currentPlaylist = playlist.map(s => {
            if (s.id === activeSongIdRef.current) {
                return {
                    ...s,
                    cachedTracks: tracksRef.current,
                    cachedDuration: durationRef.current,
                    cachedVideoDuration: videoDurationRef.current,
                    cachedVideoOffset: videoOffsetRef.current,
                    analysis: songAnalysisRef.current
                };
            }
            return s;
        });

        const presetData = {
            version: 1,
            playlist: currentPlaylist.map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                key: song.key,
                bpm: song.bpm,
                analysis: song.analysis || null,
                cachedDuration: song.cachedDuration,
                cachedVideoDuration: song.cachedVideoDuration,
                cachedVideoOffset: song.cachedVideoOffset,
                tracks: (song.cachedTracks || []).map(t => ({
                    name: t.name,
                    volume: t.volume,
                    pan: t.pan !== undefined ? t.pan : 0,
                    muted: t.muted,
                    soloed: t.soloed,
                    color: t.color,
                    isVideoAudio: t.isVideoAudio
                }))
            }))
        };

        const blob = new Blob([JSON.stringify(presetData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'multivideotrack-preset.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [playlist]);

    const importPreset = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.version !== 1 || !data.playlist) {
                alert('Archivo de preset inválido.');
                return;
            }

            const newPlaylist: Song[] = data.playlist.map((pSong: any) => ({
                id: pSong.id || crypto.randomUUID(),
                title: pSong.title,
                artist: pSong.artist || '',
                key: pSong.key || '',
                bpm: pSong.bpm || 0,
                analysis: pSong.analysis || null,
                stemFiles: [],
                videoFile: null,
                cachedDuration: pSong.cachedDuration,
                cachedVideoDuration: pSong.cachedVideoDuration,
                cachedVideoOffset: pSong.cachedVideoOffset,
                isPlaceholder: true,
                cachedTracks: pSong.tracks.map((t: any) => ({
                    id: crypto.randomUUID(),
                    name: t.name,
                    file: null,
                    volume: t.volume,
                    pan: t.pan !== undefined ? t.pan : 0,
                    muted: t.muted,
                    soloed: t.soloed,
                    color: t.color,
                    isVideoAudio: t.isVideoAudio
                }))
            }));

            stopAudioInternal();
            setTracks([]);
            setDuration(0);
            setVideoDuration(0);
            setVideoOffset(0);
            setCurrentTime(0);
            pauseTimeRef.current = 0;
            setIsPlaying(false);
            cancelAnimationFrame(animationFrameRef.current!);
            setActiveSongId(null);

            setPlaylist(newPlaylist);
        } catch (error) {
            console.error('Error importing preset', error);
            alert('Error al leer el archivo de preset.');
        }
    }, [stopAudioInternal]);

    const getMasterLevels = useCallback((): [number, number] => {
        if (!analysersRef.current || !isPlayingRef.current) return [0, 0];
        const dataL = new Float32Array(analysersRef.current.left.fftSize);
        const dataR = new Float32Array(analysersRef.current.right.fftSize);
        analysersRef.current.left.getFloatTimeDomainData(dataL);
        analysersRef.current.right.getFloatTimeDomainData(dataR);

        let sumL = 0, sumR = 0;
        for (let i = 0; i < dataL.length; i++) {
            sumL += dataL[i] * dataL[i];
            sumR += dataR[i] * dataR[i];
        }
        const rmsL = Math.sqrt(sumL / dataL.length);
        const rmsR = Math.sqrt(sumR / dataR.length);

        return [Math.min(1, rmsL * 4), Math.min(1, rmsR * 4)];
    }, []);

    const getTrackLevel = useCallback((id: string): number => {
        if (!isPlayingRef.current) return 0;
        const analyser = trackAnalysersRef.current.get(id);
        if (!analyser) return 0;

        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        // Multiply by 6 for more sensitive visuals on individual channels
        return Math.min(1, rms * 6);
    }, []);

    return (
        <AudioEngineContext.Provider value={{
            tracks,
            isPlaying,
            currentTime,
            duration,
            addTrack,
            addVideoTrack,
            removeTrack,
            clearTracks,
            togglePlay,
            stop,
            seek,
            setTrackVolume,
            setTrackPan,
            toggleTrackMute,
            toggleTrackSolo,
            setVideoElement: (el) => videoRef.current = el,
            masterVolume,
            setMasterVolume,
            playlist,
            activeSongId,
            addSongToPlaylist,
            removeSongFromPlaylist,
            updateSongInPlaylist,
            loadSong,
            loadPreparedSong,
            updateActiveSongCache,
            prepareSongCache,
            exportPreset,
            importPreset,
            videoDuration,
            trimVideoToAudio,
            songAnalysis,
            videoOffset,
            setVideoOffset,
            loadingProgress,
            getMasterLevels,
            getTrackLevel
        }}>
            {children}
        </AudioEngineContext.Provider>
    );
};
