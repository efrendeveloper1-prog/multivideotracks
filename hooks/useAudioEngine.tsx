import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

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
}

interface AudioEngineContextType {
    tracks: Track[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    addTrack: (file: File, name: string) => Promise<void>;
    addVideoTrack: (file: File) => Promise<void>;
    removeTrack: (id: string) => void;
    togglePlay: () => void;
    stop: () => void;
    seek: (time: number) => void;
    setTrackVolume: (id: string, volume: number) => void;
    toggleTrackMute: (id: string) => void;
    toggleTrackSolo: (id: string) => void;
    setVideoElement: (element: HTMLVideoElement | null) => void;
    masterVolume: number;
    setMasterVolume: (val: number) => void;
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

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
    const masterGainRef = useRef<GainNode | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();

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

    // Master Volume Effect
    useEffect(() => {
        if (masterGainRef.current) {
            masterGainRef.current.gain.value = masterVolume;
        }
    }, [masterVolume]);

    // Color helper
    const getTrackColor = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drum')) return '#06b6d4'; // cyan
        if (n.includes('bass')) return '#0d9488'; // teal
        if (n.includes('vox') || n.includes('voz')) return '#2563eb'; // blue
        if (n.includes('click')) return '#dc2626'; // red
        if (n.includes('key') || n.includes('piano')) return '#d946ef'; // fuchsia
        return '#94a3b8'; // slate
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

            // Update total duration if this track is longer
            setDuration(prev => Math.max(prev, audioBuffer.duration));
        } catch (e) {
            console.error("Error decoding audio", e);
            alert("Error al cargar audio: " + name);
        }
    }, []);

    const playAudio = useCallback((startOffset: number) => {
        if (!audioContextRef.current || !masterGainRef.current) return;

        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        const anySolo = tracks.some(t => t.soloed);

        tracks.forEach(track => {
            if (!track.buffer) return;

            // Create nodes
            const source = audioContextRef.current!.createBufferSource();
            source.buffer = track.buffer;

            const gainNode = audioContextRef.current!.createGain();

            // Initial gain
            const shouldLogicallyMute = track.muted || (anySolo && !track.soloed);
            gainNode.gain.value = shouldLogicallyMute ? 0 : track.volume;

            // Connect
            source.connect(gainNode);
            gainNode.connect(masterGainRef.current!);

            // Start
            // audioBufferSource starts at X, loops? No.
            // start(when, offset, duration)
            source.start(0, startOffset);

            // Save refs
            sourceNodesRef.current.set(track.id, source);
            gainNodesRef.current.set(track.id, gainNode);

            // Cleanup on end
            source.onended = () => {
                // optional cleanup
            };
        });
    }, [tracks]);

    const stopAudio = useCallback(() => {
        sourceNodesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourceNodesRef.current.clear();
        gainNodesRef.current.clear();
    }, []);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            // Pause
            stopAudio();
            pauseTimeRef.current = currentTime;
            if (videoRef.current) videoRef.current.pause();
            cancelAnimationFrame(animationFrameRef.current!);
        } else {
            // Play
            // If at end, restart?
            let start = pauseTimeRef.current;
            if (start >= duration && duration > 0) {
                start = 0;
                pauseTimeRef.current = 0;
            }

            playAudio(start);
            startTimeRef.current = audioContextRef.current!.currentTime - start;

            if (videoRef.current) {
                videoRef.current.currentTime = start;
                videoRef.current.play().catch(e => console.error("Video play failed", e));
            }

            // Loop
            const update = () => {
                const now = audioContextRef.current!.currentTime;
                const calculatedTime = now - startTimeRef.current;

                if (calculatedTime >= duration && duration > 0) {
                    stop();
                    return;
                }

                setCurrentTime(calculatedTime);
                animationFrameRef.current = requestAnimationFrame(update);
            };
            animationFrameRef.current = requestAnimationFrame(update);
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying, currentTime, playAudio, stopAudio, duration]);

    const stop = useCallback(() => {
        stopAudio();
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        cancelAnimationFrame(animationFrameRef.current!);
    }, [stopAudio]);

    const seek = useCallback((time: number) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) stopAudio();

        pauseTimeRef.current = time;
        setCurrentTime(time);

        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }

        if (wasPlaying) {
            playAudio(time);
            startTimeRef.current = audioContextRef.current!.currentTime - time;
        }
    }, [isPlaying, playAudio, stopAudio]);

    // Live Volume/Mute/Solo updates
    useEffect(() => {
        const anySolo = tracks.some(t => t.soloed);

        tracks.forEach(track => {
            const shouldLogicallyMute = track.muted || (anySolo && !track.soloed);
            const targetVolume = shouldLogicallyMute ? 0 : track.volume;

            if (track.name === "VIDEO TRACK" && videoRef.current) {
                // Direct control for video element since we didn't route it
                videoRef.current.volume = targetVolume * masterVolume; // Simple master application
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

    return (
        <AudioEngineContext.Provider value={{
            tracks,
            isPlaying,
            currentTime,
            duration,
            addTrack,
            addVideoTrack,
            removeTrack,
            togglePlay,
            stop,
            seek,
            setTrackVolume,
            toggleTrackMute,
            toggleTrackSolo,
            setVideoElement: (el) => videoRef.current = el,
            masterVolume,
            setMasterVolume
        }}>
            {children}
        </AudioEngineContext.Provider>
    );
};
