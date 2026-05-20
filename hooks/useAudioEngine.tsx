"use client";
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { analyzeAudio, AudioAnalysis } from '@/utils/audioAnalysis';

// Types
export interface CutRegion { start: number; end: number; }
export interface LyricBlock { id: string; text: string; startTime: number | null; endTime?: number | null; }
export interface LyricsSettings { 
    align: 'left' | 'center' | 'right'; 
    position: 'top' | 'middle' | 'bottom'; 
    fontSize: number; 
    fontFamily: string; 
    animation: 'none' | 'blur-in' | 'slide-up' | 'zoom-in'; 
    idleAnimation: 'none' | 'float-pulse-shine' | 'zoom-in-slow' | 'zoom-out-slow'; 
    exitAnimation: 'none' | 'slide-down-stagger'; 
    kineticMode: 'none' | 'by-letter' | 'by-word';
    kineticAnimation: 'wave' | 'fall-in' | 'bounce' | 'flip' | 'glitch-reveal' | 'slide-cascade';
    kineticStagger: number;
    kineticExitAnimation: 'none' | 'fade-out' | 'wave-out' | 'scatter' | 'collapse' | 'blur-out';
}
export interface TimelineSection { id: string; label: string; start: number; end: number; color: string; loopMode: 'none' | 'infinite' | 'custom'; loopCount: number; }
export interface PanelSizes { main: Record<string, number>; left: Record<string, number>; timeline: Record<string, number>; sidebar: Record<string, number>; }
export const DEFAULT_PANEL_SIZES: PanelSizes = { main: { 'main-left': 75, 'main-right': 25 }, left: { 'left-top': 70, 'left-mixer': 30 }, timeline: { 'tl-lyrics': 30, 'tl-video': 40, 'tl-master': 30 }, sidebar: { 'sidebar-preview': 40, 'sidebar-list': 60 } };
export const DEFAULT_LYRICS_SETTINGS: LyricsSettings = { align: 'center', position: 'bottom', fontSize: 60, fontFamily: 'Montserrat, sans-serif', animation: 'blur-in', idleAnimation: 'float-pulse-shine', exitAnimation: 'slide-down-stagger', kineticMode: 'none', kineticAnimation: 'wave', kineticStagger: 40, kineticExitAnimation: 'wave-out' };

export interface Track { id: string; name: string; file: File | null; buffer?: AudioBuffer; volume: number; muted: boolean; soloed: boolean; color: string; isVideoAudio?: boolean; pan: number; outputChannel?: number; }
export interface Song { id: string; title: string; artist: string; key: string; bpm: number; stemFiles: File[]; videoFile?: File | null; cachedTracks?: Track[]; cachedDuration?: number; cachedSections?: TimelineSection[]; cachedVideoDuration?: number; cachedVideoOffset?: number; cachedVideoEndTime?: number; cachedCutRegions?: CutRegion[]; cachedSplitPoints?: number[]; cachedLyrics?: LyricBlock[]; cachedLyricsSettings?: LyricsSettings; cachedVideoFadeIn?: number; cachedVideoFadeOut?: number; isPlaceholder?: boolean; analysis?: AudioAnalysis | null; }

interface AudioEngineContextType {
    tracks: Track[]; isPlaying: boolean; currentTime: number; duration: number; addTrack: (file: File, name: string) => Promise<void>; addVideoTrack: (file: File) => Promise<void>; removeTrack: (id: string) => void; clearTracks: () => void; togglePlay: () => void; stop: () => void; seek: (time: number) => void; setTrackVolume: (id: string, volume: number) => void; setTrackPan: (id: string, pan: number) => void; toggleTrackMute: (id: string) => void; toggleTrackSolo: (id: string) => void; setVideoElement: (element: HTMLVideoElement | null) => void; masterVolume: number; setMasterVolume: (val: number) => void; videoDuration: number; trimVideoToAudio: () => void; videoOffset: number; setVideoOffset: (offset: number) => void; videoEndTime: number; setVideoEndTime: (time: number) => void; videoFadeIn: number; setVideoFadeIn: (val: number) => void; videoFadeOut: number; setVideoFadeOut: (val: number) => void; videoOpacity: number; cutRegions: CutRegion[]; setCutRegions: (regions: CutRegion[]) => void; splitPoints: number[]; setSplitPoints: React.Dispatch<React.SetStateAction<number[]>>; addCutRegion: (region: CutRegion) => void; removeCutRegion: (index: number) => void; revertVideo: () => void; isInCutRegion: boolean; lyrics: LyricBlock[]; setLyrics: React.Dispatch<React.SetStateAction<LyricBlock[]>>; addLyricBlock: (block: Omit<LyricBlock, 'id'>) => void; updateLyricBlock: (id: string, updates: Partial<LyricBlock>) => void; removeLyricBlock: (id: string) => void; clearLyrics: () => void; lyricsSettings: LyricsSettings; setLyricsSettings: React.Dispatch<React.SetStateAction<LyricsSettings>>; invertBackground: boolean; setInvertBackground: React.Dispatch<React.SetStateAction<boolean>>; showLyrics: boolean; setShowLyrics: React.Dispatch<React.SetStateAction<boolean>>; panelSizes: PanelSizes; setPanelSizes: React.Dispatch<React.SetStateAction<PanelSizes>>; layoutVersion: number; playlist: Song[]; activeSongId: string | null; addSongToPlaylist: (song: Song) => void; removeSongFromPlaylist: (id: string) => void; updateSongInPlaylist: (id: string, song: Song) => void; loadSong: (id: string) => Promise<void>; loadPreparedSong: (song: Song) => void; updateActiveSongCache: () => void; prepareSongCache: (song: Song, placeholderSettings?: Song) => Promise<Song>; exportPreset: () => void; importPreset: (file: File) => Promise<void>; songAnalysis: AudioAnalysis | null; loadingProgress: number | null; getMasterLevels: () => [number, number]; getTrackLevel: (id: string) => number; isUploading: boolean; setIsUploading: (val: boolean) => void; uploadMessage: string; setUploadMessage: (msg: string) => void; processZipFile: (file: File) => Promise<void>; processVideoFile: (file: File) => Promise<void>; sections: TimelineSection[]; setSections: React.Dispatch<React.SetStateAction<TimelineSection[]>>; pitchShift: number; setPitchShift: (val: number) => void; playbackRate: number; setPlaybackRate: (val: number) => void;
    audioOutputDeviceId: string; audioOutputMaxChannels: number; setAudioOutputDevice: (id: string) => Promise<void>; setTrackOutputChannel: (id: string, channel: number) => void;
    isRecording: boolean; startRecording: () => void; stopRecording: () => void; downloadTrack: (id: string) => void;
    getRecordingTimeDomainData: (dataArray: Float32Array) => void;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);
export const useAudioEngine = () => { const context = useContext(AudioEngineContext); if (!context) throw new Error('useAudioEngine must be used within AudioEngineProvider'); return context; };

export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [masterVolume, setMasterVolume] = useState(1);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoOffset, setVideoOffset] = useState(0); 
    const [videoEndTime, setVideoEndTime] = useState(0); 
    const [videoFadeIn, setVideoFadeIn] = useState(0);
    const [videoFadeOut, setVideoFadeOut] = useState(0);
    const [videoOpacity, setVideoOpacity] = useState(1);
    const [sections, setSections] = useState<TimelineSection[]>([]);
    const [cutRegions, setCutRegions] = useState<CutRegion[]>([]);
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    const [isInCutRegion, setIsInCutRegion] = useState(false);
    const [lyrics, setLyrics] = useState<LyricBlock[]>([]);
    const [lyricsSettings, setLyricsSettings] = useState<LyricsSettings>(DEFAULT_LYRICS_SETTINGS);
    const [invertBackground, setInvertBackground] = useState<boolean>(false);
    const [showLyrics, setShowLyrics] = useState(true);
    const [playlist, setPlaylist] = useState<Song[]>([]);
    const [activeSongId, setActiveSongId] = useState<string | null>(null);
    const [songAnalysis, setSongAnalysis] = useState<AudioAnalysis | null>(null);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [layoutVersion, setLayoutVersion] = useState<number>(0);
    const [pitchShift, setPitchShift] = useState<number>(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>('default');
    const [audioOutputMaxChannels, setAudioOutputMaxChannels] = useState<number>(2);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [panelSizes, setPanelSizes] = useState<PanelSizes>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('studioPanelSizes');
            if (saved) { try { const parsed = JSON.parse(saved); if (parsed.main && !Array.isArray(parsed.main)) return parsed; } catch { } }
        }
        return DEFAULT_PANEL_SIZES;
    });

    useEffect(() => { localStorage.setItem('studioPanelSizes', JSON.stringify(panelSizes)); }, [panelSizes]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
    const pannerNodesRef = useRef<Map<string, StereoPannerNode>>(new Map());
    const masterGainRef = useRef<GainNode | null>(null);
    
    // Buses and ST nodes
    const soundTouchNodeClassRef = useRef<any>(null);
    const soundTouchNodesRef = useRef<Map<string, any>>(new Map());

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();
    const durationRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const videoOffsetRef = useRef<number>(0);
    const tracksRef = useRef<Track[]>([]);
    const videoDurationRef = useRef<number>(0);
    const videoEndTimeRef = useRef<number>(0);
    const videoFadeInRef = useRef<number>(0);
    const videoFadeOutRef = useRef<number>(0);
    const cutRegionsRef = useRef<CutRegion[]>([]);
    const splitPointsRef = useRef<number[]>([]);
    const sectionsRef = useRef<TimelineSection[]>([]);
    const loopStatusRef = useRef<{ sectionId: string, loopsRemaining: number | 'infinite' } | null>(null);
    const lastLoopTriggerTimeRef = useRef<number>(0);
    const isInCutRegionRef = useRef<boolean>(false);
    const lyricsRef = useRef<LyricBlock[]>([]);
    const lyricsSettingsRef = useRef<LyricsSettings>(DEFAULT_LYRICS_SETTINGS);
    const activeSongIdRef = useRef<string | null>(null);
    const playlistRef = useRef<Song[]>([]);
    const songAnalysisRef = useRef<AudioAnalysis | null>(null);
    const masterVolumeRefLocal = useRef<number>(1);
    const analysersRef = useRef<{ left: AnalyserNode, right: AnalyserNode } | null>(null);
    const trackAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());

    useEffect(() => {
        const initAudio = async () => {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioCtx();
            masterGainRef.current = audioContextRef.current.createGain();
            masterGainRef.current.connect(audioContextRef.current.destination);
            const splitter = audioContextRef.current.createChannelSplitter(2);
            masterGainRef.current.connect(splitter);
            const analyserL = audioContextRef.current.createAnalyser(); analyserL.fftSize = 512;
            const analyserR = audioContextRef.current.createAnalyser(); analyserR.fftSize = 512;
            splitter.connect(analyserL, 0); splitter.connect(analyserR, 1);
            analysersRef.current = { left: analyserL, right: analyserR };

            try {
                const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet');
                await SoundTouchNode.register(audioContextRef.current, '/soundtouch-processor.js');
                soundTouchNodeClassRef.current = SoundTouchNode;
            } catch (e) {
                console.error("Failed to load SoundTouch processor", e);
            }
        };
        initAudio();
        return () => { audioContextRef.current?.close(); };
    }, []);

    const playbackRateRef = useRef<number>(1);
    
    useEffect(() => {
        durationRef.current = duration; isPlayingRef.current = isPlaying; videoOffsetRef.current = videoOffset;
        tracksRef.current = tracks; videoDurationRef.current = videoDuration; videoEndTimeRef.current = videoEndTime;
        videoFadeInRef.current = videoFadeIn; videoFadeOutRef.current = videoFadeOut; cutRegionsRef.current = cutRegions;
        splitPointsRef.current = splitPoints; sectionsRef.current = sections; lyricsRef.current = lyrics; lyricsSettingsRef.current = lyricsSettings;
        activeSongIdRef.current = activeSongId; songAnalysisRef.current = songAnalysis;
        playlistRef.current = playlist;
        if (soundTouchNodesRef.current) {
            soundTouchNodesRef.current.forEach((st, key) => {
                const isDrum = key.endsWith('_true');
                try {
                    st.pitchSemitones.value = isDrum ? 0 : pitchShift;
                    st.playbackRate.value = playbackRate;
                } catch(e) {}
            });
        }
        
        const oldRate = playbackRateRef.current;
        if (oldRate !== playbackRate) {
            playbackRateRef.current = playbackRate;
            if (isPlayingRef.current && audioContextRef.current) {
                const currCtxTime = audioContextRef.current.currentTime;
                const now = (currCtxTime - startTimeRef.current) * oldRate;
                startTimeRef.current = currCtxTime - (now / playbackRate);
            }
            sourceNodesRef.current.forEach(s => {
                try { s.playbackRate.value = playbackRate; } catch(e) {}
            });
            if (videoRef.current) videoRef.current.playbackRate = playbackRate;
        }
    }, [duration, isPlaying, videoOffset, tracks, videoDuration, videoEndTime, videoFadeIn, videoFadeOut, cutRegions, splitPoints, sections, lyrics, lyricsSettings, activeSongId, songAnalysis, playlist, pitchShift, playbackRate]);

    useEffect(() => { masterVolumeRefLocal.current = masterVolume; if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume; }, [masterVolume]);

    useEffect(() => {
        if (!audioContextRef.current) return;
        const anySolo = tracks.some(t => t.soloed);
        const now = audioContextRef.current.currentTime;
        tracks.forEach(t => {
            const panner = pannerNodesRef.current.get(t.id);
            if (panner) panner.pan.setTargetAtTime(t.pan || 0, now, 0.02);
            
            if (!t.isVideoAudio) {
                const gain = gainNodesRef.current.get(t.id);
                if (gain) {
                    const targetGain = t.muted || (anySolo && !t.soloed) ? 0 : t.volume;
                    gain.gain.setTargetAtTime(targetGain, now, 0.02);
                }
            }
        });
    }, [tracks]);


    const getTrackColor = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drum') || n.includes('bateria')) return '#06b6d4';
        if (n.includes('bass') || n.includes('bajo')) return '#0d9488';
        if (n.includes('vox') || n.includes('voz') || n.includes('vocal')) return '#2563eb';
        if (n.includes('click') || n.includes('guia') || n.includes('cue') || n.includes('guide')) return '#dc2626';
        if (n.includes('key') || n.includes('piano') || n.includes('synth')) return '#d946ef';
        if (n.includes('guitar') || n.includes('guit')) return '#f59e0b';
        if (n.includes('video')) return '#a855f7';
        return '#94a3b8';
    };

    const sortTracks = (list: Track[]) => [...list].sort((a,b) => {
        const isG = (n: string) => n.toLowerCase().match(/click|guia|cue|guide/);
        return (isG(a.name) ? -1 : 0) - (isG(b.name) ? -1 : 0);
    });

    const addTrack = useCallback(async (file: File, name: string) => {
        if (!audioContextRef.current) return;
        try {
            const buf = await audioContextRef.current.decodeAudioData(await file.arrayBuffer());
            const track: Track = { id: crypto.randomUUID(), name, file, buffer: buf, volume: 1, pan: name.toLowerCase().match(/click|guia|cue|guide/) ? -1 : 1, muted: false, soloed: false, color: getTrackColor(name) };
            setTracks(prev => sortTracks([...prev, track])); setDuration(prev => Math.max(prev, buf.duration));
            if (!songAnalysisRef.current) analyzeAudio(buf).then(setSongAnalysis).catch(() => {});
        } catch (e) { console.error("Error decoding audio", e); }
    }, []);

    const addVideoTrack = useCallback(async (file: File) => {
        if (!audioContextRef.current) return;
        const oldVid = tracksRef.current.find(t => t.name === "VIDEO TRACK");
        const videoTrack: Track = { id: oldVid?.id || crypto.randomUUID(), name: "VIDEO TRACK", file, buffer: undefined, volume: oldVid?.volume || 1, pan: oldVid?.pan || 1, muted: true, soloed: false, color: '#a855f7' };
        const audioTrack: Track = { id: crypto.randomUUID(), name: "VIDEO AUDIO", file, buffer: undefined, volume: 1, pan: 1, muted: true, soloed: false, color: '#c084fc', isVideoAudio: true };
        setTracks(prev => sortTracks([...prev.filter(t => t.name !== "VIDEO TRACK" && !t.isVideoAudio), videoTrack, audioTrack]));
        try { const buf = await audioContextRef.current.decodeAudioData(await file.arrayBuffer()); setTracks(prev => prev.map(t => t.id === audioTrack.id ? { ...t, buffer: buf } : t)); } catch {}
        const v = document.createElement('video'); v.src = URL.createObjectURL(file); v.onloadedmetadata = () => { setVideoDuration(v.duration); setVideoEndTime(v.duration); setDuration(p => p === 0 ? v.duration : p); };
    }, []);

    const stopAudioInternal = () => {
        sourceNodesRef.current.forEach(s => { try { s.stop(); } catch {} }); sourceNodesRef.current.clear(); gainNodesRef.current.clear(); pannerNodesRef.current.clear(); trackAnalysersRef.current.clear();
        soundTouchNodesRef.current.forEach(st => { try { st.disconnect(); } catch {} }); soundTouchNodesRef.current.clear();
        isInCutRegionRef.current = false; setIsInCutRegion(false); setVideoOpacity(1);
    };

    const playAudio = useCallback((start: number) => {
        if (!audioContextRef.current || !masterGainRef.current) return;
        if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
        const solo = tracksRef.current.some(t => t.soloed);
        
        const maxCh = audioContextRef.current.destination.maxChannelCount;
        const merger = audioContextRef.current.createChannelMerger(Math.max(2, maxCh));
        merger.connect(audioContextRef.current.destination);

        const buses = new Map<string, GainNode>();
        
        const getBus = (targetChannel: number, isDrum: boolean) => {
            const key = `${targetChannel}_${isDrum}`;
            if (!buses.has(key)) {
                const busGain = audioContextRef.current!.createGain();
                let outNode: AudioNode = busGain;

                if (soundTouchNodeClassRef.current) {
                    const st = new soundTouchNodeClassRef.current(audioContextRef.current!);
                    st.playbackRate.value = playbackRateRef.current;
                    st.pitchSemitones.value = isDrum ? 0 : pitchShift;
                    soundTouchNodesRef.current.set(key, st);
                    busGain.connect(st);
                    outNode = st;
                }

                if (targetChannel > 0 && targetChannel < maxCh) {
                    const splitter = audioContextRef.current!.createChannelSplitter(2);
                    outNode.connect(splitter);
                    splitter.connect(merger, 0, targetChannel);
                    if (targetChannel + 1 < maxCh) {
                        splitter.connect(merger, 1, targetChannel + 1);
                    } else {
                        splitter.connect(merger, 1, targetChannel);
                    }
                } else {
                    outNode.connect(masterGainRef.current!);
                }

                buses.set(key, busGain);
            }
            return buses.get(key)!;
        };

        tracksRef.current.forEach(t => {
            if (!t.buffer) return;
            const s = audioContextRef.current!.createBufferSource(); s.buffer = t.buffer;
            const g = audioContextRef.current!.createGain(); g.gain.value = t.muted || (solo && !t.soloed) ? 0 : t.volume;
            const p = audioContextRef.current!.createStereoPanner(); p.pan.value = t.pan || 0;
            const a = audioContextRef.current!.createAnalyser(); a.fftSize = 256;
            const isDrum = !!t.name.toLowerCase().match(/drum|bateria|perc|click|guia|cue|guide/);
            
            s.connect(g);
            g.connect(a);
            a.connect(p);
            
            const targetChannel = t.outputChannel || 0;
            const bus = getBus(targetChannel, isDrum);
            p.connect(bus);
            
            s.playbackRate.value = playbackRateRef.current;
            let w = 0, o = start; if (t.isVideoAudio) { const sum = start + videoOffsetRef.current; if (sum >= 0) o = sum; else { w = audioContextRef.current!.currentTime + Math.abs(sum) / playbackRateRef.current; o = 0; } }
            try { s.start(w, o); } catch {} sourceNodesRef.current.set(t.id, s); gainNodesRef.current.set(t.id, g); pannerNodesRef.current.set(t.id, p); trackAnalysersRef.current.set(t.id, a);
        });
    }, [pitchShift]);

    const togglePlay = useCallback(() => {
        if (isPlayingRef.current) { stopAudioInternal(); pauseTimeRef.current = currentTime; videoRef.current?.pause(); cancelAnimationFrame(animationFrameRef.current!); setIsPlaying(false); }
        else {
            let start = pauseTimeRef.current >= durationRef.current ? 0 : pauseTimeRef.current;
            playAudio(start); startTimeRef.current = audioContextRef.current!.currentTime - (start / playbackRateRef.current);
            if (videoRef.current) { const vPos = start + videoOffsetRef.current; if (vPos >= 0) { videoRef.current.currentTime = vPos; videoRef.current.playbackRate = playbackRateRef.current; videoRef.current.play().catch(() => {}); } else videoRef.current.currentTime = 0; }
            setIsPlaying(true);
            let lastRenderTime = 0;
            const update = () => {
                // Advance now by actual time elapsed * playback rate
                const now = (audioContextRef.current!.currentTime - startTimeRef.current) * playbackRateRef.current;
                const vNow = now + videoOffsetRef.current;
                const cut = cutRegionsRef.current.find(r => now >= r.start && now < r.end);
                const hasV = tracksRef.current.some(t => t.isVideoAudio);
                const inactive = !!cut || (hasV && (now >= videoEndTimeRef.current || vNow >= videoDurationRef.current || vNow < 0));
                let op = 1; if (inactive) op = 0; else { const vStart = Math.max(0, -videoOffsetRef.current), fi = videoFadeInRef.current, fo = videoFadeOutRef.current; if (fi > 0 && now < vStart + fi) op = (now - vStart) / fi; else if (fo > 0 && now > videoEndTimeRef.current - fo) op = (videoEndTimeRef.current - now) / fo; }
                
                if (inactive) { if (!isInCutRegionRef.current) { isInCutRegionRef.current = true; setIsInCutRegion(true); tracksRef.current.forEach(t => { if (t.isVideoAudio) gainNodesRef.current.get(t.id)?.gain.setTargetAtTime(0, 0, 0.02); }); videoRef.current?.pause(); } }
                else { const solo = tracksRef.current.some(t => t.soloed); tracksRef.current.forEach(t => { if (t.isVideoAudio) gainNodesRef.current.get(t.id)?.gain.setTargetAtTime(t.muted || (solo && !t.soloed) ? 0 : t.volume * op, 0, 0.02); }); if (isInCutRegionRef.current) { isInCutRegionRef.current = false; setIsInCutRegion(false); if (videoRef.current && vNow >= 0 && vNow < videoDurationRef.current) { videoRef.current.currentTime = vNow; videoRef.current.play().catch(() => {}); } } }
                
                // Section Loop Logic
                const activeLoopSection = sectionsRef.current.find(s => s.loopMode !== 'none' && now >= s.start && now <= s.end + 0.1);
                if (activeLoopSection) {
                    const isCloseToEnd = now >= activeLoopSection.end;
                    if (isCloseToEnd && Math.abs(now - lastLoopTriggerTimeRef.current) > 1.0) {
                        if (!loopStatusRef.current || loopStatusRef.current.sectionId !== activeLoopSection.id) {
                            loopStatusRef.current = { sectionId: activeLoopSection.id, loopsRemaining: activeLoopSection.loopMode === 'infinite' ? 'infinite' : activeLoopSection.loopCount };
                        }
                        
                        if (loopStatusRef.current.loopsRemaining === 'infinite' || loopStatusRef.current.loopsRemaining > 0) {
                            if (loopStatusRef.current.loopsRemaining !== 'infinite') {
                                loopStatusRef.current.loopsRemaining--;
                            }
                            // Seek immediately and re-start the frame so playhead keeps moving
                            seek(activeLoopSection.start);
                            lastLoopTriggerTimeRef.current = activeLoopSection.start;
                            animationFrameRef.current = requestAnimationFrame(update);
                            return;
                        }
                    }
                }
                
                // Clear loop status if playhead is manually moved outside
                if (loopStatusRef.current) {
                    const statusSection = sectionsRef.current.find(s => s.id === loopStatusRef.current?.sectionId);
                    if (!statusSection || now < statusSection.start || now > statusSection.end + 0.5) {
                         loopStatusRef.current = null;
                    }
                }

                if (now >= durationRef.current && durationRef.current > 0) { stop(); return; }

                const sysNow = performance.now();
                if (sysNow - lastRenderTime > 33) {
                    setVideoOpacity(op);
                    setCurrentTime(now);
                    lastRenderTime = sysNow;
                }

                animationFrameRef.current = requestAnimationFrame(update);
            }; animationFrameRef.current = requestAnimationFrame(update);
        }
    }, [currentTime, playAudio]);

    const stop = useCallback(() => { stopAudioInternal(); videoRef.current?.pause(); if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoOffsetRef.current); pauseTimeRef.current = 0; setCurrentTime(0); setIsPlaying(false); cancelAnimationFrame(animationFrameRef.current!); loopStatusRef.current = null; lastLoopTriggerTimeRef.current = 0; }, []);
    const seek = useCallback((t: number) => { const was = isPlayingRef.current; if (was) stopAudioInternal(); pauseTimeRef.current = t; setCurrentTime(t); lastLoopTriggerTimeRef.current = 0; if (videoRef.current) videoRef.current.currentTime = Math.max(0, t + videoOffsetRef.current); if (was) { playAudio(t); startTimeRef.current = audioContextRef.current!.currentTime - (t / playbackRateRef.current); if (videoRef.current && (t + videoOffsetRef.current) >= 0) videoRef.current.play().catch(() => {}); } }, [playAudio]);

    const setTrackVolume = (id: string, volume: number) => setTracks(prev => prev.map(t => t.id === id ? { ...t, volume } : t));
    const setTrackPan = (id: string, pan: number) => setTracks(prev => prev.map(t => t.id === id ? { ...t, pan } : t));
    const toggleTrackMute = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
    const toggleTrackSolo = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, soloed: !t.soloed } : t));
    const removeTrack = (id: string) => setTracks(prev => prev.filter(t => t.id !== id));

    const setAudioOutputDevice = async (id: string) => {
        if (!audioContextRef.current) return;
        try {
            if (typeof (audioContextRef.current as any).setSinkId === 'function') {
                await (audioContextRef.current as any).setSinkId(id);
                setAudioOutputDeviceId(id);
                const maxChannels = audioContextRef.current.destination.maxChannelCount;
                audioContextRef.current.destination.channelCount = maxChannels;
                setAudioOutputMaxChannels(maxChannels);
                if (isPlayingRef.current) {
                    const t = currentTime;
                    stop();
                    setTimeout(() => seek(t), 100);
                }
            } else {
                console.warn("setSinkId is not supported in this browser.");
            }
        } catch (e) {
            console.error("Failed to set audio output device:", e);
        }
    };
    const setTrackOutputChannel = (id: string, channel: number) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, outputChannel: channel } : t));
        if (isPlayingRef.current) {
            const t = currentTime;
            stop();
            setTimeout(() => seek(t), 50);
        }
    };
    const clearTracks = useCallback(() => { stop(); setTracks([]); setDuration(0); setVideoDuration(0); setLyrics([]); setSongAnalysis(null); }, []);
    const trimVideoToAudio = useCallback(() => { if (durationRef.current > 0) setVideoEndTime(durationRef.current); }, []);

    const addCutRegion = useCallback((r: CutRegion) => setCutRegions(prev => [...prev, r].sort((a,b) => a.start - b.start)), []);
    const removeCutRegion = (i: number) => setCutRegions(prev => prev.filter((_, idx) => idx !== i));
    const revertVideo = () => { setCutRegions([]); setSplitPoints([]); setVideoFadeIn(0); setVideoFadeOut(0); };

    const updateActiveSongCache = useCallback(() => { if (!activeSongIdRef.current) return; setPlaylist(prev => prev.map(s => s.id === activeSongIdRef.current ? { ...s, cachedTracks: tracksRef.current, cachedDuration: durationRef.current, cachedVideoDuration: videoDurationRef.current, cachedVideoOffset: videoOffsetRef.current, cachedVideoEndTime: videoEndTimeRef.current, cachedVideoFadeIn: videoFadeInRef.current, cachedVideoFadeOut: videoFadeOutRef.current, cachedCutRegions: cutRegionsRef.current, cachedSplitPoints: splitPointsRef.current, cachedSections: sectionsRef.current, cachedLyrics: lyricsRef.current, cachedLyricsSettings: lyricsSettingsRef.current, analysis: songAnalysisRef.current } : s)); }, []);

    const exportPreset = useCallback(() => {
        const p = { 
            version: "1.0", 
            activeSongId, 
            playlist: playlist.map(s => {
                // If it's the active song, we grab current live refs to ensure latest edits are saved
                const isAct = s.id === activeSongIdRef.current;
                return {
                    id: s.id, 
                    title: s.title, 
                    artist: s.artist, 
                    key: s.key, 
                    bpm: s.bpm, 
                    analysis: isAct ? songAnalysisRef.current : s.analysis, 
                    videoDuration: isAct ? videoDurationRef.current : s.cachedVideoDuration, 
                    videoOffset: isAct ? videoOffsetRef.current : s.cachedVideoOffset, 
                    videoEndTime: isAct ? videoEndTimeRef.current : s.cachedVideoEndTime, 
                    videoFadeIn: isAct ? videoFadeInRef.current : s.cachedVideoFadeIn, 
                    videoFadeOut: isAct ? videoFadeOutRef.current : s.cachedVideoFadeOut, 
                    cutRegions: isAct ? cutRegionsRef.current : s.cachedCutRegions, 
                    splitPoints: isAct ? splitPointsRef.current : s.cachedSplitPoints, 
                    sections: isAct ? sectionsRef.current : s.cachedSections,
                    lyrics: isAct ? lyricsRef.current : s.cachedLyrics, 
                    lyricsSettings: isAct ? lyricsSettingsRef.current : s.cachedLyricsSettings, 
                    tracks: (isAct ? tracksRef.current : s.cachedTracks || []).map(t => ({ name: t.name, volume: t.volume, pan: t.pan, muted: t.muted, soloed: t.soloed, isVideoAudio: t.isVideoAudio, outputChannel: t.outputChannel })) 
                };
            }), 
            panelSizes,
            audioOutputDeviceId,
            audioOutputMaxChannels,
            showLyrics,
            invertBackground
        };
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `multitrack-preset-${new Date().toISOString().split('T')[0]}.json`; a.click();
    }, [activeSongId, playlist, panelSizes, audioOutputDeviceId, audioOutputMaxChannels, showLyrics, invertBackground]);

    const importPreset = useCallback(async (file: File) => {
        try { 
            const text = await file.text(); const p = JSON.parse(text); if (p.panelSizes) setPanelSizes(p.panelSizes); 
            
            setPlaylist(prev => {
                const newPlaylist = [...prev];
                p.playlist.forEach((ps: any) => {
                    const existingIndex = newPlaylist.findIndex(existing => existing.title === ps.title);
                    const newSongObj = { 
                        ...ps, 
                        isPlaceholder: true, 
                        stemFiles: [], 
                        cachedVideoDuration: ps.videoDuration,
                        cachedVideoOffset: ps.videoOffset,
                        cachedVideoEndTime: ps.videoEndTime,
                        cachedVideoFadeIn: ps.videoFadeIn,
                        cachedVideoFadeOut: ps.videoFadeOut,
                        cachedCutRegions: ps.cutRegions,
                        cachedSplitPoints: ps.splitPoints,
                        cachedSections: ps.sections || [],
                        cachedLyrics: ps.lyrics,
                        cachedLyricsSettings: ps.lyricsSettings,
                        analysis: ps.analysis || (ps.bpm || ps.key ? { bpm: ps.bpm || 0, key: ps.key || '', scale: '', keyDisplay: ps.key || '' } : null), 
                        cachedTracks: ps.tracks.map((pt: any) => ({ id: crypto.randomUUID(), name: pt.name, volume: pt.volume, pan: pt.pan || 0, muted: pt.muted, soloed: pt.soloed, isVideoAudio: pt.isVideoAudio, outputChannel: pt.outputChannel, color: getTrackColor(pt.name) })) 
                    };
                    
                    if (existingIndex !== -1) {
                        // Merge or replace the existing one
                        newPlaylist[existingIndex] = { ...newPlaylist[existingIndex], ...newSongObj, stemFiles: newPlaylist[existingIndex].stemFiles, videoFile: newPlaylist[existingIndex].videoFile, isPlaceholder: newPlaylist[existingIndex].isPlaceholder };
                    } else {
                        newPlaylist.push(newSongObj);
                    }
                });
                return newPlaylist;
            });
            
            
            if (p.activeSongId) setActiveSongId(p.activeSongId); 
            if (p.audioOutputDeviceId) {
                setAudioOutputDevice(p.audioOutputDeviceId);
            }
            if (p.showLyrics !== undefined) setShowLyrics(p.showLyrics);
            if (p.invertBackground !== undefined) setInvertBackground(p.invertBackground);
        } catch { alert("Error al importar."); }
    }, []);

    const loadSong = async (id: string) => {
        const s = playlist.find(x => x.id === id); if (!s) return;
        stop(); setTracks(s.cachedTracks || []); setDuration(s.cachedDuration || 0); setVideoDuration(s.cachedVideoDuration || 0); setVideoOffset(s.cachedVideoOffset || 0); setVideoEndTime(s.cachedVideoEndTime || s.cachedVideoDuration || 0); setVideoFadeIn(s.cachedVideoFadeIn || 0); setVideoFadeOut(s.cachedVideoFadeOut || 0); setCutRegions(s.cachedCutRegions || []); setSplitPoints(s.cachedSplitPoints || []); setSections(s.cachedSections || []); setLyrics(s.cachedLyrics || []); if (s.cachedLyricsSettings) setLyricsSettings(s.cachedLyricsSettings); setSongAnalysis(s.analysis || null); setActiveSongId(id);
    };

    const prepareSongCache = async (s: Song, placeholder?: Song): Promise<Song> => {
        if (!audioContextRef.current) return s;
        const nt: Track[] = []; let nd = 0; setLoadingProgress(0);
        for (const f of s.stemFiles) {
            const buf = await audioContextRef.current.decodeAudioData(await f.arrayBuffer());
            const name = f.name.replace(/\.(wav|mp3)$/i, '');
            
            let vol = 1; let pan = name.toLowerCase().match(/click|guia|cue|guide/) ? -1 : 1;
            let mute = false; let solo = false;
            
            let outCh: number | undefined;

            if (placeholder && placeholder.cachedTracks) {
                const pt = placeholder.cachedTracks.find(t => t.name === name);
                if (pt) {
                    vol = pt.volume; pan = pt.pan; mute = pt.muted; solo = pt.soloed; outCh = pt.outputChannel;
                }
            }

            nt.push({ id: crypto.randomUUID(), name, file: f, buffer: buf, volume: vol, pan, muted: mute, soloed: solo, outputChannel: outCh, color: getTrackColor(name) });
            nd = Math.max(nd, buf.duration); setLoadingProgress(Math.round((nt.length / (s.stemFiles.length + (s.videoFile ? 1 : 0))) * 100));
        }

        let analysis = placeholder?.analysis || s.analysis || undefined;
        if (!analysis && nt.length > 0) {
            try {
                setUploadMessage('Analizando BPM/KEY...');
                const mixLength = Math.max(...nt.map(t => t.buffer!.length));
                const mixSampleRate = nt[0].buffer!.sampleRate;
                const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
                const offlineCtx = new OfflineCtx(1, mixLength, mixSampleRate);
                const clickCtx = new OfflineCtx(1, mixLength, mixSampleRate);
                
                let added = 0;
                let addedClick = 0;
                nt.forEach(t => {
                    const isClick = !!t.name.toLowerCase().match(/click|guia|cue|guide/);
                    if (!isClick) {
                        const src = offlineCtx.createBufferSource();
                        src.buffer = t.buffer!;
                        src.connect(offlineCtx.destination);
                        src.start(0);
                        added++;
                    } else {
                        const srcClick = clickCtx.createBufferSource();
                        srcClick.buffer = t.buffer!;
                        srcClick.connect(clickCtx.destination);
                        srcClick.start(0);
                        addedClick++;
                    }
                });
                
                if (added === 0) {
                    const src = offlineCtx.createBufferSource();
                    src.buffer = nt.find(t => !!t.name.toLowerCase().match(/click|guia|cue|guide/))?.buffer || nt[0].buffer!;
                    src.connect(offlineCtx.destination);
                    src.start(0);
                }

                const masterMix = await offlineCtx.startRendering();
                let rhythmMix = masterMix;
                if (addedClick > 0) {
                    rhythmMix = await clickCtx.startRendering();
                }
                analysis = await analyzeAudio(masterMix, rhythmMix);
            } catch(e) {
                console.error("Audio analysis failed:", e);
            }
        }

        setLoadingProgress(null); 
        return { 
            ...s, 
            cachedTracks: sortTracks(nt), 
            cachedDuration: nd, 
            cachedLyrics: placeholder?.cachedLyrics || s.cachedLyrics || [], 
            cachedLyricsSettings: placeholder?.cachedLyricsSettings || s.cachedLyricsSettings || undefined,
            cachedVideoDuration: placeholder?.cachedVideoDuration || s.cachedVideoDuration || undefined,
            cachedVideoOffset: placeholder?.cachedVideoOffset || s.cachedVideoOffset || undefined,
            cachedVideoEndTime: placeholder?.cachedVideoEndTime || s.cachedVideoEndTime || undefined,
            cachedVideoFadeIn: placeholder?.cachedVideoFadeIn || s.cachedVideoFadeIn || undefined,
            cachedVideoFadeOut: placeholder?.cachedVideoFadeOut || s.cachedVideoFadeOut || undefined,
            cachedCutRegions: placeholder?.cachedCutRegions || s.cachedCutRegions || [],
            cachedSplitPoints: placeholder?.cachedSplitPoints || s.cachedSplitPoints || [],
            cachedSections: placeholder?.cachedSections || s.cachedSections || [],
            isPlaceholder: false, 
            analysis: analysis || null 
        };
    };

    const addSongToPlaylist = (s: Song) => setPlaylist(prev => [...prev, s]);
    const removeSongFromPlaylist = (id: string) => setPlaylist(prev => prev.filter(x => x.id !== id));
    const updateSongInPlaylist = (id: string, s: Song) => setPlaylist(prev => prev.map(x => x.id === id ? s : x));
    const loadPreparedSong = (s: Song) => { 
        stop(); 
        setTracks(s.cachedTracks || []); 
        setDuration(s.cachedDuration || 0); 
        setVideoDuration(s.cachedVideoDuration || 0); 
        setVideoOffset(s.cachedVideoOffset || 0); 
        setVideoEndTime(s.cachedVideoEndTime || s.cachedVideoDuration || 0); 
        setVideoFadeIn(s.cachedVideoFadeIn || 0); 
        setVideoFadeOut(s.cachedVideoFadeOut || 0); 
        setCutRegions(s.cachedCutRegions || []); 
        setSplitPoints(s.cachedSplitPoints || []); 
        setSections(s.cachedSections || []);
        setLyrics(s.cachedLyrics || []); 
        if (s.cachedLyricsSettings) setLyricsSettings(s.cachedLyricsSettings); 
        setActiveSongId(s.id); 
        setSongAnalysis(s.analysis || null); 
    };

    const getMasterLevels = (): [number, number] => {
        if (!analysersRef.current || !isPlayingRef.current) return [0, 0];
        const dL = new Float32Array(256), dR = new Float32Array(256);
        analysersRef.current.left.getFloatTimeDomainData(dL); analysersRef.current.right.getFloatTimeDomainData(dR);
        let sL = 0, sR = 0; for (let i = 0; i < 256; i++) { sL += dL[i]*dL[i]; sR += dR[i]*dR[i]; }
        return [Math.sqrt(sL/256), Math.sqrt(sR/256)];
    };

    const getTrackLevel = (id: string): number => {
        const a = trackAnalysersRef.current.get(id); if (!a || !isPlayingRef.current) return 0;
        const d = new Float32Array(256); a.getFloatTimeDomainData(d);
        let s = 0; for (let i = 0; i < 256; i++) s += d[i]*d[i];
        return Math.min(1, Math.sqrt(s/256) * 6);
    };

    const downloadTrack = useCallback((id: string) => {
        const track = tracksRef.current.find(t => t.id === id);
        if (track && track.file) {
            const url = URL.createObjectURL(track.file);
            const a = document.createElement('a');
            a.href = url;
            a.download = track.file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioContextRef.current) {
                const source = audioContextRef.current.createMediaStreamSource(stream);
                const analyser = audioContextRef.current.createAnalyser();
                analyser.fftSize = 2048;
                source.connect(analyser);
                recordingAnalyserRef.current = analyser;
            }
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], `VOZ GRABADA - ${new Date().toISOString().replace(/:/g, '-')}.webm`, { type: 'audio/webm' });
                await addTrack(file, "VOZ GRABADA");
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            if (!isPlayingRef.current) {
                togglePlay();
            }
        } catch (e) {
            console.error("Error starting recording:", e);
            alert("No se pudo acceder al micrófono.");
        }
    }, [addTrack, togglePlay]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        recordingAnalyserRef.current = null;
    }, []);

    const getRecordingTimeDomainData = useCallback((dataArray: Float32Array) => {
        if (recordingAnalyserRef.current) {
            recordingAnalyserRef.current.getFloatTimeDomainData(dataArray as any);
        } else {
            dataArray.fill(0);
        }
    }, []);

    const processZipFile = async (file: File) => {
        setIsUploading(true); setUploadMessage('Extrayendo ZIP...');
        const zip = new JSZip(), contents = await zip.loadAsync(file), stems: File[] = []; let vid: File | undefined;
        const ps: Promise<void>[] = [];
        contents.forEach((path, entry) => {
            if (entry.dir) return;
            if (path.match(/\.(wav|mp3)$/i)) ps.push(entry.async('blob').then(b => { stems.push(new File([b], path.split('/').pop() || 't', { type: 'audio/mpeg' })); }));
            else if (path.match(/\.(mp4|mov|webm|avi)$/i)) ps.push(entry.async('blob').then(b => { vid = new File([b], path.split('/').pop() || 'v', { type: 'video/mp4' }); }));
        });
        await Promise.all(ps);
        
        const title = file.name.replace('.zip','');
        const existingSong = playlistRef.current?.find(s => s.title.toLowerCase() === title.toLowerCase());
        
        let newSongData: Song = { 
            id: existingSong ? existingSong.id : crypto.randomUUID(), 
            title: existingSong ? existingSong.title : title, 
            artist: existingSong?.artist || '', 
            key: existingSong?.key || '', 
            bpm: existingSong?.bpm || 0, 
            stemFiles: stems, 
            videoFile: vid 
        };

        const song = await prepareSongCache(newSongData, existingSong);
        
        if (existingSong) {
            updateSongInPlaylist(song.id, song);
        } else {
            addSongToPlaylist(song);
        }
        
        loadPreparedSong(song); 
        setIsUploading(false);
    };

    return (
        <AudioEngineContext.Provider value={{
            tracks, isPlaying, currentTime, duration, addTrack, addVideoTrack, removeTrack, clearTracks, togglePlay, stop, seek, setTrackVolume, setTrackPan, toggleTrackMute, toggleTrackSolo, setVideoElement: (el) => { videoRef.current = el; }, masterVolume, setMasterVolume, playlist, activeSongId, addSongToPlaylist, removeSongFromPlaylist, updateSongInPlaylist, loadSong, loadPreparedSong, updateActiveSongCache, prepareSongCache, exportPreset, importPreset, videoDuration, trimVideoToAudio, videoOffset, setVideoOffset, videoEndTime, setVideoEndTime, videoFadeIn, setVideoFadeIn, videoFadeOut, setVideoFadeOut, videoOpacity, cutRegions, setCutRegions, splitPoints, setSplitPoints, addCutRegion, removeCutRegion, revertVideo, isInCutRegion, lyrics, setLyrics, addLyricBlock: (b) => setLyrics(p => [...p, {...b, id: crypto.randomUUID()}]), updateLyricBlock: (id, u) => setLyrics(p => p.map(l => l.id === id ? {...l, ...u} : l)), removeLyricBlock: (id) => setLyrics(p => p.filter(l => l.id !== id)), clearLyrics: () => setLyrics([]), lyricsSettings, setLyricsSettings, invertBackground, setInvertBackground, showLyrics, setShowLyrics, panelSizes, setPanelSizes, layoutVersion, loadingProgress, songAnalysis, getMasterLevels, getTrackLevel, isUploading, setIsUploading, uploadMessage, setUploadMessage, processZipFile, processVideoFile: async (f) => { await addVideoTrack(f); }, sections, setSections, pitchShift, setPitchShift, playbackRate, setPlaybackRate,
            audioOutputDeviceId, audioOutputMaxChannels, setAudioOutputDevice, setTrackOutputChannel,
            isRecording, startRecording, stopRecording, downloadTrack, getRecordingTimeDomainData
        }}>
            {children}
        </AudioEngineContext.Provider>
    );
};
