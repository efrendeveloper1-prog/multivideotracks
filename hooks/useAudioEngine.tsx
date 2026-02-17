import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { analyzeAudio, AudioAnalysis } from '@/utils/audioAnalysis';

// Types
export interface Track {
    id: string;
    name: string;
    file: File;
    buffer?: AudioBuffer;
    volume: number;
    muted: boolean;
    soloed: boolean;
    color: string;
    isVideoAudio?: boolean; // Flag for the extracted audio from video
}

export interface Song {
    id: string;
    title: string;
    artist: string;
    key: string;
    bpm: number;
    stemFiles: File[];
    videoFile?: File;
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
    loadSong: (id: string) => Promise<void>;
    // Audio analysis
    songAnalysis: AudioAnalysis | null;
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

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
    const masterGainRef = useRef<GainNode | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();
    const durationRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const videoOffsetRef = useRef<number>(0);

    // Initialize AudioContext
    useEffect(() => {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);
        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    // Keep refs in sync with state
    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { videoOffsetRef.current = videoOffset; }, [videoOffset]);

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

        // 1. Create the visual VIDEO TRACK (no buffer, for timeline thumbnails)
        const videoTrack: Track = {
            id: crypto.randomUUID(),
            name: "VIDEO TRACK",
            file: videoFile,
            buffer: undefined,
            volume: 1,
            muted: false,
            soloed: false,
            color: '#a855f7'
        };

        // 2. Try to extract audio from video and create a separate audio channel
        let audioTrack: Track | null = null;
        try {
            const arrayBuffer = await videoFile.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));

            audioTrack = {
                id: crypto.randomUUID(),
                name: "VIDEO AUDIO",
                file: videoFile,
                buffer: audioBuffer,
                volume: 1,
                muted: false,
                soloed: false,
                color: '#c084fc',
                isVideoAudio: true
            };
        } catch (e) {
            console.warn("Video has no extractable audio or decode failed:", e);
        }

        setTracks(prev => {
            const newTracks = [...prev, videoTrack];
            if (audioTrack) newTracks.push(audioTrack);
            return newTracks;
        });

        // Emit event for the UI to catch and set video src
        const customEvent = new CustomEvent('video-uploaded', { detail: url });
        window.dispatchEvent(customEvent);

        // Get video duration (store separately, do NOT extend master duration)
        const tempVideo = document.createElement('video');
        tempVideo.src = url;
        tempVideo.onloadedmetadata = () => {
            setVideoDuration(tempVideo.duration);
            // Only use video duration if there are NO audio tracks yet
            setDuration(prev => {
                if (prev === 0) return tempVideo.duration; // No audio, use video duration
                return prev; // Audio exists, keep audio duration as master
            });
        };
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

            source.connect(gainNode);
            gainNode.connect(masterGainRef.current!);
            source.start(0, startOffset);

            sourceNodesRef.current.set(track.id, source);
            gainNodesRef.current.set(track.id, gainNode);

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
                videoRef.current.currentTime = Math.max(0, start + videoOffsetRef.current);
                videoRef.current.play().catch(e => console.error("Video play failed", e));
            }

            setIsPlaying(true);
            isPlayingRef.current = true;

            const update = () => {
                if (!isPlayingRef.current) return; // Guard: if stopped externally

                const now = audioContextRef.current?.currentTime;
                if (now === undefined) return;
                const calculatedTime = now - startTimeRef.current;
                const dur = durationRef.current;

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
            videoRef.current.currentTime = Math.max(0, time + videoOffsetRef.current);
        }

        if (wasPlaying) {
            playAudio(time);
            startTimeRef.current = audioContextRef.current!.currentTime - time;
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
        });
    }, [tracks, masterVolume]);

    const setTrackVolume = (id: string, volume: number) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, volume } : t));
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
    const addSongToPlaylist = useCallback((song: Song) => {
        setPlaylist(prev => [...prev, song]);
    }, []);

    const removeSongFromPlaylist = useCallback((id: string) => {
        setPlaylist(prev => prev.filter(s => s.id !== id));
    }, []);

    const loadSong = useCallback(async (id: string) => {
        const song = playlist.find(s => s.id === id);
        if (!song) return;

        // Stop current playback and clear tracks
        stopAudioInternal();
        cancelAnimationFrame(animationFrameRef.current!);
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        setDuration(0);
        setTracks([]);
        setActiveSongId(id);

        // Load all stem files
        for (const stemFile of song.stemFiles) {
            const trackName = stemFile.name.replace(/\.(wav|mp3)$/i, '');
            await addTrack(stemFile, trackName);
        }

        // Load video if present
        if (song.videoFile) {
            await addVideoTrack(song.videoFile);
        }
    }, [playlist, addTrack, addVideoTrack]);

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
            toggleTrackMute,
            toggleTrackSolo,
            setVideoElement: (el) => videoRef.current = el,
            masterVolume,
            setMasterVolume,
            playlist,
            activeSongId,
            addSongToPlaylist,
            removeSongFromPlaylist,
            loadSong,
            videoDuration,
            trimVideoToAudio,
            songAnalysis,
            videoOffset,
            setVideoOffset
        }}>
            {children}
        </AudioEngineContext.Provider>
    );
};
