"use client";
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { analyzeAudio, AudioAnalysis } from '@/utils/audioAnalysis';
import { performExportMixToMp3 } from '@/utils/exportMix';


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
export const DEFAULT_LYRICS_SETTINGS: LyricsSettings = { align: 'center', position: 'middle', fontSize: 60, fontFamily: 'Montserrat, sans-serif', animation: 'zoom-in', idleAnimation: 'zoom-in-slow', exitAnimation: 'none', kineticMode: 'none', kineticAnimation: 'wave', kineticStagger: 40, kineticExitAnimation: 'wave-out' };

export interface ChordBlock { id: string; chord: string; startTime: number; endTime: number; }
export interface Track { id: string; name: string; file: File | null; buffer?: AudioBuffer; volume: number; muted: boolean; soloed: boolean; color: string; isVideoAudio?: boolean; pan: number; outputChannel?: number; }
export interface Song { id: string; title: string; artist: string; key: string; bpm: number; stemFiles: File[]; videoFile?: File | null; cachedTracks?: Track[]; cachedDuration?: number; cachedSections?: TimelineSection[]; cachedVideoDuration?: number; cachedVideoOffset?: number; cachedVideoEndTime?: number; cachedCutRegions?: CutRegion[]; cachedSplitPoints?: number[]; cachedLyrics?: LyricBlock[]; cachedLyricsSettings?: LyricsSettings; cachedVideoFadeIn?: number; cachedVideoFadeOut?: number; cachedVideoFadeInType?: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'; cachedVideoFadeOutType?: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'; isPlaceholder?: boolean; analysis?: AudioAnalysis | null; locateProgress?: number; locateStatus?: 'pending' | 'searching' | 'unzipping' | 'decoding' | 'completed' | 'not_found'; cachedChords?: ChordBlock[]; }

interface AudioEngineContextType {
    tracks: Track[]; isPlaying: boolean; currentTime: number; duration: number; setDuration: React.Dispatch<React.SetStateAction<number>>; addTrack: (file: File, name: string) => Promise<void>; addVideoTrack: (file: File) => Promise<void>; removeTrack: (id: string) => void; clearTracks: () => void; togglePlay: () => void; stop: () => void; seek: (time: number) => void; setTrackVolume: (id: string, volume: number) => void; setTrackPan: (id: string, pan: number) => void; toggleTrackMute: (id: string) => void; toggleTrackSolo: (id: string) => void; setVideoElement: (element: HTMLVideoElement | null) => void; masterVolume: number; setMasterVolume: (val: number) => void; videoDuration: number; trimVideoToAudio: () => void; videoOffset: number; setVideoOffset: (offset: number) => void; videoEndTime: number; setVideoEndTime: (time: number) => void; videoFadeIn: number; setVideoFadeIn: (val: number) => void; videoFadeOut: number; setVideoFadeOut: (val: number) => void; videoFadeInType: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'; setVideoFadeInType: React.Dispatch<React.SetStateAction<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>>; videoFadeOutType: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'; setVideoFadeOutType: React.Dispatch<React.SetStateAction<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>>; videoOpacity: number; cutRegions: CutRegion[]; setCutRegions: (regions: CutRegion[]) => void; splitPoints: number[]; setSplitPoints: React.Dispatch<React.SetStateAction<number[]>>; addCutRegion: (region: CutRegion) => void; removeCutRegion: (index: number) => void; revertVideo: () => void; isInCutRegion: boolean; lyrics: LyricBlock[]; setLyrics: React.Dispatch<React.SetStateAction<LyricBlock[]>>; addLyricBlock: (block: Omit<LyricBlock, 'id'>) => void; updateLyricBlock: (id: string, updates: Partial<LyricBlock>) => void; removeLyricBlock: (id: string) => void; clearLyrics: () => void; lyricsSettings: LyricsSettings; setLyricsSettings: React.Dispatch<React.SetStateAction<LyricsSettings>>; invertBackground: boolean; setInvertBackground: React.Dispatch<React.SetStateAction<boolean>>; showLyrics: boolean; setShowLyrics: React.Dispatch<React.SetStateAction<boolean>>; panelSizes: PanelSizes; setPanelSizes: React.Dispatch<React.SetStateAction<PanelSizes>>;     layoutVersion: number; playlist: Song[]; setPlaylist: React.Dispatch<React.SetStateAction<Song[]>>; activeSongId: string | null; addSongToPlaylist: (song: Song) => void; removeSongFromPlaylist: (id: string) => void; updateSongInPlaylist: (id: string, song: Song) => void; loadSong: (id: string) => Promise<void>; loadPreparedSong: (song: Song) => void; updateActiveSongCache: () => void; prepareSongCache: (song: Song, placeholderSettings?: Song, onProgress?: (progress: number, message?: string) => void) => Promise<Song>; exportPreset: () => void; importPreset: (file: File) => Promise<void>; songAnalysis: AudioAnalysis | null; loadingProgress: number | null; getMasterLevels: () => [number, number]; getTrackLevel: (id: string) => number; isUploading: boolean; setIsUploading: (val: boolean) => void; uploadMessage: string; setUploadMessage: (msg: string) => void; processZipFile: (file: File) => Promise<void>; processVideoFile: (file: File) => Promise<void>; sections: TimelineSection[]; setSections: React.Dispatch<React.SetStateAction<TimelineSection[]>>; pitchShift: number; setPitchShift: (val: number) => void; playbackRate: number; setPlaybackRate: (val: number) => void;
    customChords: ChordBlock[]; setCustomChords: React.Dispatch<React.SetStateAction<ChordBlock[]>>; addChordBlock: (block: Omit<ChordBlock, 'id'>) => void; updateChordBlock: (id: string, updates: Partial<ChordBlock>) => void; removeChordBlock: (id: string) => void; clearChords: () => void;

    audioOutputDeviceId: string; audioOutputMaxChannels: number; setAudioOutputDevice: (id: string) => Promise<void>; setTrackOutputChannel: (id: string, channel: number) => void;
    isRecording: boolean; startRecording: () => void; stopRecording: () => void; downloadTrack: (id: string) => void;
    getRecordingTimeDomainData: (dataArray: Float32Array) => void;
    isCountInEnabled: boolean; setIsCountInEnabled: (val: boolean) => void;
    countInClicks: number; setCountInClicks: (val: number) => void;
    isCountingIn: boolean; currentCountInBeat: number;
    countInOutputChannel: number; setCountInOutputChannel: (val: number) => void;
    recordingLatency: number; setRecordingLatency: (val: number | ((prev: number) => number)) => void;
    isExporting: boolean;
    exportProgress: number;
    exportStatus: string;
    exportMixToMp3: () => Promise<void>;
    exportMixToMp4: (resolution: '720p' | '1080p') => Promise<void>;
    cancelExport: () => void;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);
export const useAudioEngine = () => { const context = useContext(AudioEngineContext); if (!context) throw new Error('useAudioEngine must be used within AudioEngineProvider'); return context; };

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

const getSoundTouchLatency = (sampleRate: number): number => {
    const tempo = 1;
    const overlapMs = 8;
    
    const AUTOSEQ_C = 130;
    const AUTOSEQ_K = -20;
    const AUTOSEQ_AT_MIN = 125;
    const AUTOSEQ_AT_MAX = 50;
    
    let seq = AUTOSEQ_C + AUTOSEQ_K * tempo;
    seq = seq < AUTOSEQ_AT_MAX ? AUTOSEQ_AT_MAX : (seq > AUTOSEQ_AT_MIN ? AUTOSEQ_AT_MIN : seq);
    const sequenceMs = Math.floor(seq + 0.5);
    
    const AUTOSEEK_C = 25.66666667;
    const AUTOSEEK_K = -2.666666667;
    const AUTOSEEK_AT_MIN = 25;
    const AUTOSEEK_AT_MAX = 15;
    
    let seek = AUTOSEEK_C + AUTOSEEK_K * tempo;
    seek = seek < AUTOSEEK_AT_MAX ? AUTOSEEK_AT_MAX : (seek > AUTOSEEK_AT_MIN ? AUTOSEEK_AT_MIN : seek);
    const seekWindowMs = Math.floor(seek + 0.5);
    
    const seekWindowLength = Math.floor(sampleRate * sequenceMs / 1000);
    const seekLength = Math.floor(sampleRate * seekWindowMs / 1000);
    
    let overlapLength = sampleRate * overlapMs / 1000;
    overlapLength = overlapLength < 16 ? 16 : overlapLength;
    overlapLength -= overlapLength % 8;
    
    const nominalSkip = tempo * (seekWindowLength - overlapLength);
    const intskip = Math.floor(nominalSkip + 0.5);
    const sampleReq = Math.max(intskip + overlapLength, seekWindowLength) + seekLength;
    
    const N = overlapLength + sampleReq;
    const K = Math.ceil(N / 128);
    const latencySamples = (K - 1) * 128;
    return latencySamples / sampleRate;
};

const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length - 44, true);

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    pos = 44;
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
};



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
    const [videoFadeInType, setVideoFadeInType] = useState<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>('slow');
    const [videoFadeOutType, setVideoFadeOutType] = useState<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>('slow');
    const [videoOpacity, setVideoOpacity] = useState(1);
    const [sections, setSections] = useState<TimelineSection[]>([]);
    const [cutRegions, setCutRegions] = useState<CutRegion[]>([]);
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    const [isInCutRegion, setIsInCutRegion] = useState(false);
    const [lyrics, setLyrics] = useState<LyricBlock[]>([]);
    const [customChords, setCustomChords] = useState<ChordBlock[]>([]);
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
    const [recordingLatency, setRecordingLatency] = useState<number>(120);
    const recordingLatencyRef = useRef<number>(120);

    const [isCountInEnabled, setIsCountInEnabled] = useState<boolean>(false);
    const [countInClicks, setCountInClicks] = useState<number>(4);
    const [isCountingIn, setIsCountingIn] = useState<boolean>(false);
    const [currentCountInBeat, setCurrentCountInBeat] = useState<number>(0);
    const [countInOutputChannel, setCountInOutputChannel] = useState<number>(0);

    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportProgress, setExportProgress] = useState<number>(0);
    const [exportStatus, setExportStatus] = useState<string>('');

    const isCountInEnabledRef = useRef<boolean>(false);
    const countInClicksRef = useRef<number>(4);
    const countInOutputChannelRef = useRef<number>(0);

    // Load count-in settings on mount
    useEffect(() => {
        const savedEnabled = localStorage.getItem('multitrack_count_in_enabled');
        if (savedEnabled !== null) {
            const enabled = savedEnabled === 'true';
            setIsCountInEnabled(enabled);
            isCountInEnabledRef.current = enabled;
        }
        const savedClicks = localStorage.getItem('multitrack_count_in_clicks');
        if (savedClicks !== null) {
            const clicks = parseInt(savedClicks);
            setCountInClicks(clicks);
            countInClicksRef.current = clicks;
        }
        const savedChannel = localStorage.getItem('multitrack_count_in_output_channel');
        if (savedChannel !== null) {
            const chan = parseInt(savedChannel);
            setCountInOutputChannel(chan);
            countInOutputChannelRef.current = chan;
        }
        const savedLatency = localStorage.getItem('multitrack_recording_latency');
        if (savedLatency !== null) {
            const latency = parseInt(savedLatency);
            setRecordingLatency(latency);
            recordingLatencyRef.current = latency;
        }
    }, []);

    const handleSetIsCountInEnabled = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        setIsCountInEnabled(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            isCountInEnabledRef.current = next;
            localStorage.setItem('multitrack_count_in_enabled', String(next));
            return next;
        });
    }, []);

    const handleSetCountInClicks = useCallback((val: number | ((prev: number) => number)) => {
        setCountInClicks(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            countInClicksRef.current = next;
            localStorage.setItem('multitrack_count_in_clicks', String(next));
            return next;
        });
    }, []);

    const handleSetCountInOutputChannel = useCallback((val: number | ((prev: number) => number)) => {
        setCountInOutputChannel(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            countInOutputChannelRef.current = next;
            localStorage.setItem('multitrack_count_in_output_channel', String(next));
            return next;
        });
    }, []);

    const handleSetRecordingLatency = useCallback((val: number | ((prev: number) => number)) => {
        setRecordingLatency(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            recordingLatencyRef.current = next;
            localStorage.setItem('multitrack_recording_latency', String(next));
            return next;
        });
    }, []);

    const recStartCtxTimeRef = useRef<number>(0);
    const recStartTimeRefValueRef = useRef<number>(0);
    const recPlaybackRateRef = useRef<number>(1);
    const stopRecordingRef = useRef<() => void>(() => {});

    const scheduledClicksRef = useRef<OscillatorNode[]>([]);
    const countInTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
    const videoSyncedAfterCountInRef = useRef<boolean>(false);
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
    const delayNodesRef = useRef<Map<string, DelayNode>>(new Map());
    const soundTouchLatencyRef = useRef<number>(0);
    const lastSeekTargetRef = useRef<number | null>(null);
    const lastSeekTimeRef = useRef<number>(0);

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
    const videoFadeInTypeRef = useRef<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>('slow');
    const videoFadeOutTypeRef = useRef<'linear' | 'fast' | 'slow' | 'smooth' | 'sharp'>('slow');
    const cutRegionsRef = useRef<CutRegion[]>([]);
    const splitPointsRef = useRef<number[]>([]);
    const sectionsRef = useRef<TimelineSection[]>([]);
    const loopStatusRef = useRef<{ sectionId: string, loopsRemaining: number | 'infinite' } | null>(null);
    const lastLoopTriggerTimeRef = useRef<number>(0);
    const isInCutRegionRef = useRef<boolean>(false);
    const lyricsRef = useRef<LyricBlock[]>([]);
    const lyricsSettingsRef = useRef<LyricsSettings>(DEFAULT_LYRICS_SETTINGS);
    const customChordsRef = useRef<ChordBlock[]>([]);
    const activeSongIdRef = useRef<string | null>(null);
    const playlistRef = useRef<Song[]>([]);
    const songAnalysisRef = useRef<AudioAnalysis | null>(null);
    const masterVolumeRefLocal = useRef<number>(1);
    const analysersRef = useRef<{ left: AnalyserNode, right: AnalyserNode } | null>(null);
    const trackAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());

    // Video export-specific refs
    const invertBackgroundRef = useRef<boolean>(false);
    const isExportingRef = useRef<boolean>(false);
    const currentTimeRef = useRef<number>(0);
    const cancelExportRef = useRef<(() => void) | null>(null);

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
                await SoundTouchNode.register(audioContextRef.current, '/soundtouch-processor.js?v=2');
                soundTouchNodeClassRef.current = SoundTouchNode;
                if (audioContextRef.current) {
                    soundTouchLatencyRef.current = getSoundTouchLatency(audioContextRef.current.sampleRate);
                }
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
        videoFadeInRef.current = videoFadeIn; videoFadeOutRef.current = videoFadeOut;
        videoFadeInTypeRef.current = videoFadeInType; videoFadeOutTypeRef.current = videoFadeOutType;
        cutRegionsRef.current = cutRegions;
        splitPointsRef.current = splitPoints; sectionsRef.current = sections; lyricsRef.current = lyrics; lyricsSettingsRef.current = lyricsSettings; customChordsRef.current = customChords;
        activeSongIdRef.current = activeSongId; songAnalysisRef.current = songAnalysis;
        playlistRef.current = playlist;
        invertBackgroundRef.current = invertBackground;
        isExportingRef.current = isExporting;
        currentTimeRef.current = currentTime;
        if (soundTouchNodesRef.current) {
            soundTouchNodesRef.current.forEach((st, key) => {
                const isDrum = key.endsWith('_true');
                try {
                    st.pitchSemitones.value = isDrum ? 0 : pitchShift;
                    st.playbackRate.value = playbackRate;
                } catch(e) {}
            });
        }
        if (delayNodesRef.current) {
            const latency = (pitchShift !== 0 || playbackRate !== 1) ? soundTouchLatencyRef.current : 0;
            delayNodesRef.current.forEach((d, key) => {
                const isDrum = key.endsWith('_true');
                let targetDelay = 0;
                if (isDrum && playbackRate === 1 && pitchShift !== 0) {
                    targetDelay = latency;
                }
                try {
                    d.delayTime.setValueAtTime(targetDelay, audioContextRef.current?.currentTime || 0);
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
    }, [duration, isPlaying, videoOffset, tracks, videoDuration, videoEndTime, videoFadeIn, videoFadeOut, videoFadeInType, videoFadeOutType, cutRegions, splitPoints, sections, lyrics, lyricsSettings, activeSongId, songAnalysis, playlist, pitchShift, playbackRate]);

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
        delayNodesRef.current.forEach(d => { try { d.disconnect(); } catch {} }); delayNodesRef.current.clear();
        lastSeekTargetRef.current = null;
        isInCutRegionRef.current = false; setIsInCutRegion(false); setVideoOpacity(1);
        
        // Stop scheduled click oscillators and visual update timeouts
        scheduledClicksRef.current.forEach(osc => { try { osc.stop(); } catch(e) {} });
        scheduledClicksRef.current = [];
        countInTimeoutsRef.current.forEach(clearTimeout);
        countInTimeoutsRef.current = [];
    };

    const playAudio = useCallback((start: number, startDelay: number = 0, baseTime?: number) => {
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

                let delayNode: DelayNode | null = null;
                if (audioContextRef.current) {
                    try {
                        delayNode = audioContextRef.current.createDelay(1.0);
                        const latency = (pitchShift !== 0 || playbackRateRef.current !== 1) ? soundTouchLatencyRef.current : 0;
                        let targetDelay = 0;
                        if (isDrum && playbackRateRef.current === 1 && pitchShift !== 0) {
                            targetDelay = latency;
                        }
                        delayNode.delayTime.setValueAtTime(targetDelay, audioContextRef.current.currentTime);
                        delayNodesRef.current.set(key, delayNode);
                    } catch (e) {
                        console.error("Failed to create DelayNode", e);
                    }
                }

                if (soundTouchNodeClassRef.current) {
                    const st = new soundTouchNodeClassRef.current(audioContextRef.current!);
                    st.playbackRate.value = playbackRateRef.current;
                    st.pitchSemitones.value = isDrum ? 0 : pitchShift;
                    soundTouchNodesRef.current.set(key, st);
                    busGain.connect(st);
                    if (delayNode) {
                        st.connect(delayNode);
                        outNode = delayNode;
                    } else {
                        outNode = st;
                    }
                } else {
                    if (delayNode) {
                        busGain.connect(delayNode);
                        outNode = delayNode;
                    } else {
                        outNode = busGain;
                    }
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
            
            // Adjust start time for count-in delay
            const nowTime = baseTime !== undefined ? baseTime : audioContextRef.current!.currentTime;
            let w = nowTime + startDelay;
            let o = start;
            if (t.isVideoAudio) {
                const sum = start + videoOffsetRef.current;
                const vDur = videoDurationRef.current > 0 ? videoDurationRef.current : t.buffer!.duration;
                if (sum >= 0) {
                    o = sum % vDur;
                } else {
                    w = nowTime + startDelay + Math.abs(sum) / playbackRateRef.current;
                    o = 0;
                }
                if (videoEndTimeRef.current > vDur) {
                    s.loop = true;
                    s.loopStart = 0;
                    s.loopEnd = vDur;
                }
            }
            
            try { s.start(w, o); } catch {}
            sourceNodesRef.current.set(t.id, s);
            gainNodesRef.current.set(t.id, g);
            pannerNodesRef.current.set(t.id, p);
            trackAnalysersRef.current.set(t.id, a);
        });
    }, [pitchShift]);

    const stop = useCallback(() => { 
        stopAudioInternal(); 
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            stopRecordingRef.current();
        }
        videoRef.current?.pause(); 
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoOffsetRef.current); 
        pauseTimeRef.current = 0; 
        setCurrentTime(0); 
        setIsPlaying(false); 
        setIsCountingIn(false);
        setCurrentCountInBeat(0);
        videoSyncedAfterCountInRef.current = false;
        cancelAnimationFrame(animationFrameRef.current!); 
        loopStatusRef.current = null; 
        lastLoopTriggerTimeRef.current = 0; 
    }, []);

    const seek = useCallback((t: number) => { 
        let targetTime = t;
        let cut = cutRegionsRef.current.find(r => targetTime >= r.start && targetTime < r.end);
        while (cut) {
            targetTime = cut.end;
            cut = cutRegionsRef.current.find(r => targetTime >= r.start && targetTime < r.end);
        }
        const was = isPlayingRef.current; 
        if (was) stopAudioInternal(); 
        pauseTimeRef.current = targetTime; 
        setCurrentTime(targetTime); 
        lastLoopTriggerTimeRef.current = 0; 
        videoSyncedAfterCountInRef.current = true;
        if (videoRef.current) {
            const vPos = targetTime + videoOffsetRef.current;
            videoRef.current.currentTime = (vPos >= 0 && videoDurationRef.current > 0) ? (vPos % videoDurationRef.current) : 0;
        }
        if (was) { 
            playAudio(targetTime, 0); 
            const latency = (pitchShift !== 0 || playbackRateRef.current !== 1) ? soundTouchLatencyRef.current : 0;
            startTimeRef.current = audioContextRef.current!.currentTime + latency - (targetTime / playbackRateRef.current); 
            
            lastSeekTargetRef.current = targetTime;
            lastSeekTimeRef.current = audioContextRef.current!.currentTime;

            if (videoRef.current && (targetTime + videoOffsetRef.current) >= 0) {
                if (latency > 0) {
                    const videoTimeoutId = setTimeout(() => {
                        if (isPlayingRef.current) {
                            videoRef.current?.play().catch(() => {});
                        }
                    }, (latency * 1000) / playbackRateRef.current);
                    countInTimeoutsRef.current.push(videoTimeoutId);
                } else {
                    videoRef.current.play().catch(() => {});
                }
            }
        } 
    }, [playAudio, pitchShift]);

    const togglePlay = useCallback(() => {
        if (isPlayingRef.current) { 
            stopAudioInternal(); 
            pauseTimeRef.current = currentTime; 
            videoRef.current?.pause(); 
            cancelAnimationFrame(animationFrameRef.current!); 
            setIsPlaying(false); 
            setIsCountingIn(false);
            setCurrentCountInBeat(0);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                stopRecordingRef.current();
            }
        }
        else {
            let start = pauseTimeRef.current >= durationRef.current ? 0 : pauseTimeRef.current;
            let initialCut = cutRegionsRef.current.find(r => start >= r.start && start < r.end);
            while (initialCut) {
                start = initialCut.end;
                initialCut = cutRegionsRef.current.find(r => start >= r.start && start < r.end);
            }
            pauseTimeRef.current = start;
            setCurrentTime(start);
            
            const currentBpm = (songAnalysisRef.current?.bpm || 120) * playbackRateRef.current;
            const beatDuration = 60 / currentBpm;
            const countInDuration = isCountInEnabledRef.current ? countInClicksRef.current * beatDuration : 0;
            const latency = (pitchShift !== 0 || playbackRateRef.current !== 1) ? soundTouchLatencyRef.current : 0;
            const totalDelay = countInDuration + latency;
            
            const ctx = audioContextRef.current;
            if (ctx && ctx.state === 'suspended') ctx.resume();
            
            // Single base time to synchronize both clicks and multitrack audio
            let baseTime = ctx ? ctx.currentTime : 0;
            
            if (isCountInEnabledRef.current && ctx) {
                setIsCountingIn(true);
                setCurrentCountInBeat(1);
                videoSyncedAfterCountInRef.current = false;
                
                countInTimeoutsRef.current.forEach(clearTimeout);
                countInTimeoutsRef.current = [];
                scheduledClicksRef.current.forEach(osc => { try { osc.stop(); } catch(e) {} });
                scheduledClicksRef.current = [];
                
                // Add a small safety buffer (50ms) to ensure Web Audio hardware is active and the first click isn't cut off
                baseTime = ctx.currentTime + 0.05;
                
                // Play metronome clicks
                for (let i = 0; i < countInClicksRef.current; i++) {
                    const clickTime = baseTime + latency + i * beatDuration;
                    const isFirstBeat = (i === 0);
                    
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    const targetChannel = countInOutputChannelRef.current;
                    const maxCh = ctx.destination.maxChannelCount;
                    if (targetChannel > 0 && targetChannel < maxCh) {
                        const merger = ctx.createChannelMerger(Math.max(2, maxCh));
                        merger.connect(ctx.destination);
                        
                        const splitter = ctx.createChannelSplitter(2);
                        gain.connect(splitter);
                        splitter.connect(merger, 0, targetChannel);
                        if (targetChannel + 1 < maxCh) {
                            splitter.connect(merger, 1, targetChannel + 1);
                        } else {
                            splitter.connect(merger, 1, targetChannel);
                        }
                    } else {
                        if (masterGainRef.current) {
                            gain.connect(masterGainRef.current);
                        } else {
                            gain.connect(ctx.destination);
                        }
                    }
                    
                    osc.frequency.setValueAtTime(isFirstBeat ? 1200 : 800, clickTime);
                    gain.gain.setValueAtTime(1, clickTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.08);
                    
                    osc.start(clickTime);
                    osc.stop(clickTime + 0.1);
                    scheduledClicksRef.current.push(osc);
                    
                    const delayMs = ((latency + i * beatDuration) * 1000) / playbackRateRef.current;
                    const timeoutId = setTimeout(() => {
                        setCurrentCountInBeat(i + 1);
                    }, delayMs);
                    countInTimeoutsRef.current.push(timeoutId);
                }
                
                const endTimeoutId = setTimeout(() => {
                    setIsCountingIn(false);
                    setCurrentCountInBeat(0);
                }, (totalDelay * 1000) / playbackRateRef.current);
                countInTimeoutsRef.current.push(endTimeoutId);
            } else {
                videoSyncedAfterCountInRef.current = true;
            }
            
            playAudio(start, countInDuration, baseTime); 
            startTimeRef.current = baseTime + countInDuration + latency - (start / playbackRateRef.current);
            
            if (videoRef.current) { 
                const vPos = start + videoOffsetRef.current; 
                if (vPos >= 0 && videoDurationRef.current > 0) { 
                    videoRef.current.currentTime = vPos % videoDurationRef.current; 
                    videoRef.current.playbackRate = playbackRateRef.current; 
                    
                    if (totalDelay > 0) {
                        const videoTimeoutId = setTimeout(() => {
                            if (isPlayingRef.current) {
                                videoRef.current?.play().catch(() => {});
                            }
                        }, (totalDelay * 1000) / playbackRateRef.current);
                        countInTimeoutsRef.current.push(videoTimeoutId);
                    } else {
                        videoRef.current.play().catch(() => {});
                    }
                } else videoRef.current.currentTime = 0; 
            }
            
            setIsPlaying(true);
            let lastRenderTime = 0;
            const update = () => {
                const nowRaw = (audioContextRef.current!.currentTime - startTimeRef.current) * playbackRateRef.current;
                
                let now = nowRaw;
                if (lastSeekTargetRef.current !== null && audioContextRef.current) {
                    if (audioContextRef.current.currentTime < lastSeekTimeRef.current + latency) {
                        now = lastSeekTargetRef.current;
                    } else {
                        lastSeekTargetRef.current = null;
                    }
                }
                const vNow = now + videoOffsetRef.current;
                
                // Do not update playhead during count-in
                if (now < start) {
                    setCurrentTime(start);
                    animationFrameRef.current = requestAnimationFrame(update);
                    return;
                }

                // Force video alignment at the end of the count-in to ensure perfect sync
                if (videoRef.current && isCountInEnabledRef.current && !videoSyncedAfterCountInRef.current) {
                    videoSyncedAfterCountInRef.current = true;
                    if (vNow >= 0 && videoDurationRef.current > 0) {
                        videoRef.current.currentTime = vNow % videoDurationRef.current;
                        videoRef.current.play().catch(() => {});
                    }
                }
                
                const cut = cutRegionsRef.current.find(r => now >= r.start && now < r.end);
                if (cut) {
                    seek(cut.end);
                    return;
                }
                const hasV = tracksRef.current.some(t => t.isVideoAudio || t.name === "VIDEO TRACK");
                const vStart = Math.max(0, -videoOffsetRef.current);
                const inactive = !!cut || (hasV && (now < vStart || now >= videoEndTimeRef.current || vNow < 0));
                let op = 1;
                if (inactive) {
                    op = 0;
                } else {
                    const fi = videoFadeInRef.current, fo = videoFadeOutRef.current;
                    if (fi > 0 && now < vStart + fi) {
                        const x = (now - vStart) / fi;
                        const type = videoFadeInTypeRef.current;
                        if (type === 'linear') op = x;
                        else if (type === 'fast') op = 1 - (1 - x) * (1 - x);
                        else if (type === 'slow') op = x * x;
                        else if (type === 'smooth') op = x * x * (3 - 2 * x);
                        else if (type === 'sharp') op = Math.pow(x, 4);
                    } else if (fo > 0 && now > videoEndTimeRef.current - fo) {
                        const x = (now - (videoEndTimeRef.current - fo)) / fo;
                        const type = videoFadeOutTypeRef.current;
                        if (type === 'linear') op = 1 - x;
                        else if (type === 'fast') op = (1 - x) * (1 - x);
                        else if (type === 'slow') op = 1 - x * x;
                        else if (type === 'smooth') op = 1 - (x * x * (3 - 2 * x));
                        else if (type === 'sharp') op = Math.pow(1 - x, 4);
                    }
                }
                
                if (inactive) { if (!isInCutRegionRef.current) { isInCutRegionRef.current = true; setIsInCutRegion(true); tracksRef.current.forEach(t => { if (t.isVideoAudio) gainNodesRef.current.get(t.id)?.gain.setTargetAtTime(0, 0, 0.02); }); videoRef.current?.pause(); } }
                else { const solo = tracksRef.current.some(t => t.soloed); tracksRef.current.forEach(t => { if (t.isVideoAudio) gainNodesRef.current.get(t.id)?.gain.setTargetAtTime(t.muted || (solo && !t.soloed) ? 0 : t.volume * op, 0, 0.02); }); if (isInCutRegionRef.current || (videoRef.current && videoRef.current.paused && isPlayingRef.current)) { isInCutRegionRef.current = false; setIsInCutRegion(false); if (videoRef.current && vNow >= 0 && videoDurationRef.current > 0) { videoRef.current.currentTime = vNow % videoDurationRef.current; videoRef.current.play().catch(() => {}); } } }
                
                // Keep HTML5 video synchronized across loops if drifting by > 0.35s
                if (videoRef.current && videoDurationRef.current > 0 && !inactive) {
                    const expectedTime = vNow % videoDurationRef.current;
                    if (Math.abs(videoRef.current.currentTime - expectedTime) > 0.35) {
                        videoRef.current.currentTime = expectedTime;
                    }
                }
                
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
                            seek(activeLoopSection.start);
                            lastLoopTriggerTimeRef.current = activeLoopSection.start;
                            animationFrameRef.current = requestAnimationFrame(update);
                            return;
                        }
                    }
                }
                
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
    }, [currentTime, playAudio, seek, stop, pitchShift]);

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

    const updateActiveSongCache = useCallback(() => { if (!activeSongIdRef.current) return; setPlaylist(prev => prev.map(s => s.id === activeSongIdRef.current ? { ...s, cachedTracks: tracksRef.current, cachedDuration: durationRef.current, cachedVideoDuration: videoDurationRef.current, cachedVideoOffset: videoOffsetRef.current, cachedVideoEndTime: videoEndTimeRef.current, cachedVideoFadeIn: videoFadeInRef.current, cachedVideoFadeOut: videoFadeOutRef.current, cachedVideoFadeInType: videoFadeInTypeRef.current, cachedVideoFadeOutType: videoFadeOutTypeRef.current, cachedCutRegions: cutRegionsRef.current, cachedSplitPoints: splitPointsRef.current, cachedSections: sectionsRef.current, cachedLyrics: lyricsRef.current, cachedLyricsSettings: lyricsSettingsRef.current, analysis: songAnalysisRef.current, cachedChords: customChordsRef.current } : s)); }, []);

    const loadPreparedSong = useCallback((s: Song) => { 
        updateActiveSongCache();
        stop(); 
        setTracks(s.cachedTracks || []); 
        setDuration(s.cachedDuration || 0); 
        setVideoDuration(s.cachedVideoDuration || 0); 
        setVideoOffset(s.cachedVideoOffset || 0); 
        setVideoEndTime(s.cachedVideoEndTime || s.cachedVideoDuration || 0); 
        setVideoFadeIn(s.cachedVideoFadeIn || 0); 
        setVideoFadeOut(s.cachedVideoFadeOut || 0); 
        setVideoFadeInType(s.cachedVideoFadeInType || 'slow');
        setVideoFadeOutType(s.cachedVideoFadeOutType || 'slow');
        setCutRegions(s.cachedCutRegions || []); 
        setSplitPoints(s.cachedSplitPoints || []); 
        setSections(s.cachedSections || []);
        setLyrics(s.cachedLyrics || []); 
        if (s.cachedLyricsSettings) setLyricsSettings(s.cachedLyricsSettings); 
        setActiveSongId(s.id); 
        setSongAnalysis(s.analysis || null);
        setCustomChords(s.cachedChords || []);
    }, [updateActiveSongCache, stop]);

    const exportPreset = useCallback(async () => {
        const activeSongTitle = activeSongId ? playlist.find(s => s.id === activeSongId)?.title : '';
        const defaultName = activeSongTitle 
            ? `preset-${activeSongTitle.replace(/[/\\?%*:|"<>]/g, '-')}.json`
            : `preset-${new Date().toISOString().split('T')[0]}.json`;

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
                    videoFadeInType: isAct ? videoFadeInTypeRef.current : s.cachedVideoFadeInType,
                    videoFadeOutType: isAct ? videoFadeOutTypeRef.current : s.cachedVideoFadeOutType,
                    cutRegions: isAct ? cutRegionsRef.current : s.cachedCutRegions, 
                    splitPoints: isAct ? splitPointsRef.current : s.cachedSplitPoints, 
                    sections: isAct ? sectionsRef.current : s.cachedSections,
                    lyrics: isAct ? lyricsRef.current : s.cachedLyrics, 
                    lyricsSettings: isAct ? lyricsSettingsRef.current : s.cachedLyricsSettings, 
                    chords: isAct ? customChordsRef.current : s.cachedChords,
                    tracks: (isAct ? tracksRef.current : s.cachedTracks || []).map(t => ({ name: t.name, volume: t.volume, pan: t.pan, muted: t.muted, soloed: t.soloed, isVideoAudio: t.isVideoAudio, outputChannel: t.outputChannel })) 
                };
            }), 
            panelSizes,
            audioOutputDeviceId,
            audioOutputMaxChannels,
            showLyrics,
            invertBackground,
            isCountInEnabled,
            countInClicks,
            countInOutputChannel,
            recordingLatency
        };

        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: defaultName,
                    types: [{
                        description: 'Preset JSON',
                        accept: {
                            'application/json': ['.json'],
                        },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify(p, null, 2));
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    return;
                }
                console.error("showSaveFilePicker error, falling back:", err);
            }
        }

        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = defaultName; 
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [activeSongId, playlist, panelSizes, audioOutputDeviceId, audioOutputMaxChannels, showLyrics, invertBackground, isCountInEnabled, countInClicks, countInOutputChannel, recordingLatency]);

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
                        cachedVideoFadeInType: ps.videoFadeInType,
                        cachedVideoFadeOutType: ps.videoFadeOutType,
                        cachedCutRegions: ps.cutRegions,
                        cachedSplitPoints: ps.splitPoints,
                        cachedSections: ps.sections || [],
                        cachedLyrics: ps.lyrics,
                        cachedLyricsSettings: ps.lyricsSettings,
                        cachedChords: ps.chords || ps.cachedChords || [],
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
            
            
            if (p.activeSongId) {
                const activeSong = p.playlist.find((ps: any) => ps.id === p.activeSongId);
                if (activeSong) {
                    const activeSongObj = { 
                        id: activeSong.id, 
                        title: activeSong.title, 
                        artist: activeSong.artist, 
                        key: activeSong.key, 
                        bpm: activeSong.bpm, 
                        isPlaceholder: true, 
                        stemFiles: [], 
                        cachedVideoDuration: activeSong.videoDuration,
                        cachedVideoOffset: activeSong.videoOffset,
                        cachedVideoEndTime: activeSong.videoEndTime,
                        cachedVideoFadeIn: activeSong.videoFadeIn,
                        cachedVideoFadeOut: activeSong.videoFadeOut,
                        cachedVideoFadeInType: activeSong.videoFadeInType,
                        cachedVideoFadeOutType: activeSong.videoFadeOutType,
                        cachedCutRegions: activeSong.cutRegions,
                        cachedSplitPoints: activeSong.splitPoints,
                        cachedSections: activeSong.sections || [],
                        cachedLyrics: activeSong.lyrics,
                        cachedLyricsSettings: activeSong.lyricsSettings,
                        cachedChords: activeSong.chords || activeSong.cachedChords || [],
                        analysis: activeSong.analysis || (activeSong.bpm || activeSong.key ? { bpm: activeSong.bpm || 0, key: activeSong.key || '', scale: '', keyDisplay: activeSong.key || '' } : null), 
                        cachedTracks: activeSong.tracks.map((pt: any) => ({ id: crypto.randomUUID(), name: pt.name, volume: pt.volume, pan: pt.pan || 0, muted: pt.muted, soloed: pt.soloed, isVideoAudio: pt.isVideoAudio, outputChannel: pt.outputChannel, color: getTrackColor(pt.name) })) 
                    };
                    loadPreparedSong(activeSongObj);
                } else {
                    setActiveSongId(p.activeSongId);
                }
            }
            if (p.audioOutputDeviceId) {
                setAudioOutputDevice(p.audioOutputDeviceId);
            }
            if (p.showLyrics !== undefined) setShowLyrics(p.showLyrics);
            if (p.invertBackground !== undefined) setInvertBackground(p.invertBackground);
            if (p.isCountInEnabled !== undefined) setIsCountInEnabled(p.isCountInEnabled);
            if (p.countInClicks !== undefined) setCountInClicks(p.countInClicks);
            if (p.countInOutputChannel !== undefined) setCountInOutputChannel(p.countInOutputChannel);
            if (p.recordingLatency !== undefined) setRecordingLatency(p.recordingLatency);
        } catch { alert("Error al importar."); }
    }, [loadPreparedSong, setCountInOutputChannel, handleSetRecordingLatency]);

    const loadSong = async (id: string) => {
        if (id === activeSongIdRef.current) return;
        updateActiveSongCache();
        const s = playlist.find(x => x.id === id); if (!s) return;
        stop();
        
        let songToLoad = s;
        const hasBuffers = s.cachedTracks && s.cachedTracks.length > 0 && s.cachedTracks.every(t => t.name === "VIDEO TRACK" || t.buffer !== undefined);
        if (!hasBuffers && s.stemFiles && s.stemFiles.length > 0) {
            setIsUploading(true);
            setUploadMessage(`Cargando y decodificando ${s.title}...`);
            try {
                songToLoad = await prepareSongCache(s, s, (pct) => {
                    setLoadingProgress(pct);
                });
            } catch (e) {
                console.error("Error loading song:", e);
                alert("Error al cargar la canción.");
                setIsUploading(false);
                setLoadingProgress(null);
                return;
            }
            setIsUploading(false);
            setLoadingProgress(null);
        }
        
        setTracks(songToLoad.cachedTracks || []);
        setDuration(songToLoad.cachedDuration || 0);
        setVideoDuration(songToLoad.cachedVideoDuration || 0);
        setVideoOffset(songToLoad.cachedVideoOffset || 0);
        setVideoEndTime(songToLoad.cachedVideoEndTime || songToLoad.cachedVideoDuration || 0);
        setVideoFadeIn(songToLoad.cachedVideoFadeIn || 0);
        setVideoFadeOut(songToLoad.cachedVideoFadeOut || 0);
        setVideoFadeInType(songToLoad.cachedVideoFadeInType || 'slow');
        setVideoFadeOutType(songToLoad.cachedVideoFadeOutType || 'slow');
        setCutRegions(songToLoad.cachedCutRegions || []);
        setSplitPoints(songToLoad.cachedSplitPoints || []);
        setSections(songToLoad.cachedSections || []);
        setLyrics(songToLoad.cachedLyrics || []);
        if (songToLoad.cachedLyricsSettings) setLyricsSettings(songToLoad.cachedLyricsSettings);
        setSongAnalysis(songToLoad.analysis || null);
        setActiveSongId(id);
        setCustomChords(songToLoad.cachedChords || []);
    };

    const prepareSongCache = useCallback(async (s: Song, placeholder?: Song, onProgress?: (progress: number, message?: string) => void): Promise<Song> => {
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
            nd = Math.max(nd, buf.duration);
            const currentProgress = Math.round((nt.length / (s.stemFiles.length + (s.videoFile ? 1 : 0))) * 100);
            setLoadingProgress(currentProgress);
            if (onProgress) onProgress(currentProgress, 'Decodificando audios...');
        }

        if (s.videoFile) {
            if (onProgress) onProgress(90, 'Decodificando audio del video...');
            let vidVol = 1; let vidMute = true; let vidSolo = false;
            let audVol = 1; let audMute = true; let audSolo = false;
            let outCh: number | undefined;
            
            if (placeholder && placeholder.cachedTracks) {
                const vt = placeholder.cachedTracks.find(t => t.name === "VIDEO TRACK");
                if (vt) {
                    vidVol = vt.volume; vidMute = vt.muted; vidSolo = vt.soloed;
                }
                const at = placeholder.cachedTracks.find(t => t.isVideoAudio);
                if (at) {
                    audVol = at.volume; audMute = at.muted; audSolo = at.soloed; outCh = at.outputChannel;
                }
            }
            
            const videoTrack: Track = { id: crypto.randomUUID(), name: "VIDEO TRACK", file: s.videoFile, buffer: undefined, volume: vidVol, pan: 1, muted: vidMute, soloed: vidSolo, color: '#a855f7' };
            const audioTrack: Track = { id: crypto.randomUUID(), name: "VIDEO AUDIO", file: s.videoFile, buffer: undefined, volume: audVol, pan: 1, muted: audMute, soloed: audSolo, outputChannel: outCh, color: '#c084fc', isVideoAudio: true };
            
            try {
                const buf = await audioContextRef.current.decodeAudioData(await s.videoFile.arrayBuffer());
                audioTrack.buffer = buf;
                nd = Math.max(nd, buf.duration);
            } catch (err) {
                console.error("Error decoding video audio in prepareSongCache:", err);
            }
            nt.push(videoTrack, audioTrack);
            if (onProgress) onProgress(100, 'Decodificación completa');
        }

        let analysis = placeholder?.analysis || s.analysis || undefined;
        // Force re-analysis if we are resolving a placeholder or if it has a default/blank tempo
        const isPlaceholderLoaded = placeholder?.isPlaceholder || s.isPlaceholder;
        const lacksValidBpm = !analysis || !analysis.bpm || analysis.bpm === 120;
        
        if ((!analysis || isPlaceholderLoaded || lacksValidBpm) && nt.length > 0) {
            try {
                setUploadMessage('Analizando BPM/KEY...');
                if (onProgress) onProgress(95, 'Analizando BPM/KEY...');
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
    }, []);

    const addSongToPlaylist = (s: Song) => setPlaylist(prev => [...prev, s]);
    const removeSongFromPlaylist = (id: string) => setPlaylist(prev => prev.filter(x => x.id !== id));
    const updateSongInPlaylist = (id: string, s: Song) => setPlaylist(prev => prev.map(x => x.id === id ? s : x));

    // Background preloading and cache cleanup effect
    useEffect(() => {
        if (!activeSongId) return;
        const idx = playlist.findIndex(s => s.id === activeSongId);
        if (idx === -1) return;

        const minIdx = Math.max(0, idx - 2);
        const maxIdx = Math.min(playlist.length - 1, idx + 2);

        // 1. Identify songs that are outside the window and have buffers that need to be stripped
        let playlistNeedsUpdate = false;
        const updatedPlaylist = playlist.map((song, i) => {
            const inWindow = i >= minIdx && i <= maxIdx;
            const hasBuffers = song.cachedTracks && song.cachedTracks.length > 0 && song.cachedTracks.every(t => t.name === "VIDEO TRACK" || t.buffer !== undefined);
            
            if (!inWindow && hasBuffers) {
                playlistNeedsUpdate = true;
                return {
                    ...song,
                    cachedTracks: song.cachedTracks?.map(t => ({ ...t, buffer: undefined }))
                };
            }
            return song;
        });

        if (playlistNeedsUpdate) {
            setPlaylist(updatedPlaylist);
            return;
        }

        // 2. Identify songs inside the window that need preloading
        const songsToPreload = playlist.slice(minIdx, maxIdx + 1).filter(song => {
            if (song.id === activeSongId) return false; // Already active, no need to preload
            if (song.isPlaceholder) return false; // Placeholder, cannot preload
            if (!song.stemFiles || song.stemFiles.length === 0) return false; // No files
            
            const hasBuffers = song.cachedTracks && song.cachedTracks.length > 0 && song.cachedTracks.every(t => t.name === "VIDEO TRACK" || t.buffer !== undefined);
            return !hasBuffers;
        });

        if (songsToPreload.length > 0) {
            const targetSong = songsToPreload[0];
            const doPreload = async () => {
                if (!audioContextRef.current) return;
                try {
                    const decodedSong = await prepareSongCache(targetSong, targetSong);
                    setPlaylist(prev => prev.map(s => s.id === targetSong.id ? decodedSong : s));
                } catch (e) {
                    console.error("Error preloading song:", e);
                }
            };
            doPreload();
        }
    }, [activeSongId, playlist, prepareSongCache]);



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

    const exportMixToMp3 = useCallback(async () => {
        if (!audioContextRef.current) return;
        await performExportMixToMp3({
            activeSongId: activeSongIdRef.current,
            playlist,
            tracks: tracksRef.current,
            duration: durationRef.current,
            cutRegions: cutRegionsRef.current,
            masterVolume,
            isCountInEnabled,
            countInClicks,
            songAnalysis: songAnalysisRef.current,
            videoOffset: videoOffsetRef.current,
            videoEndTime: videoEndTimeRef.current,
            videoDuration: videoDurationRef.current,
            videoFadeIn: videoFadeInRef.current,
            videoFadeOut: videoFadeOutRef.current,
            videoFadeInType: videoFadeInTypeRef.current,
            videoFadeOutType: videoFadeOutTypeRef.current,
            audioContext: audioContextRef.current,
            setExportStatus,
            setExportProgress,
            setIsExporting,
            pitchShift,
            playbackRate
        });
    }, [playlist, masterVolume, isCountInEnabled, countInClicks, pitchShift, playbackRate]);

    const cancelExport = useCallback(() => {
        if (cancelExportRef.current) {
            cancelExportRef.current();
        } else {
            setIsExporting(false);
        }
    }, [stop]);

    const exportMixToMp4 = useCallback(async (resolution: '720p' | '1080p') => {
        if (!audioContextRef.current) return;
        if (tracksRef.current.length === 0) return;

        const dur = durationRef.current;
        if (dur <= 0) {
            alert("No hay pistas de audio cargadas.");
            return;
        }

        setIsExporting(true);
        isExportingRef.current = true;
        setExportProgress(0);
        setExportStatus("Preparando exportación de video...");

        try {
            stop();

            const canvas = document.createElement('canvas');
            const canvasWidth = resolution === '1080p' ? 1920 : 1280;
            const canvasHeight = resolution === '1080p' ? 1080 : 720;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

            const dest = audioContextRef.current.createMediaStreamDestination();
            if (!masterGainRef.current) throw new Error("Master gain node is not initialized");
            masterGainRef.current.connect(dest);

            const canvasStream = canvas.captureStream(30);

            const audioTrack = dest.stream.getAudioTracks()[0];
            const videoTrack = canvasStream.getVideoTracks()[0];
            const combinedStream = new MediaStream([videoTrack, audioTrack]);

            const mimeTypes = [
                'video/mp4;codecs=h264,aac',
                'video/mp4;codecs=avc1,mp4a.40.2',
                'video/mp4',
                'video/webm;codecs=h264,opus',
                'video/webm;codecs=vp9,opus',
                'video/webm'
            ];
            let selectedMimeType = '';
            for (const mime of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mime)) {
                    selectedMimeType = mime;
                    break;
                }
            }
            if (!selectedMimeType) {
                throw new Error("El navegador no soporta ningún formato de grabación de video compatible.");
            }

            const recorder = new MediaRecorder(combinedStream, { mimeType: selectedMimeType });
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            const videoElement = videoRef.current;
            const hasVideo = tracksRef.current.some(t => t.file && t.file.type.startsWith('video/'));

            let animationFrameId: number;
            const drawFrame = () => {
                if (!isExportingRef.current) return;

                // Calcular el tiempo transcurrido en el audio de la mezcla de forma precisa e inmediata
                const audioTime = (audioContextRef.current!.currentTime - startTimeRef.current) * playbackRateRef.current;
                const t = Math.max(0, audioTime);
                
                // Dibujar fondo
                if (hasVideo && videoElement && videoElement.readyState >= 2) {
                    const videoWidth = videoElement.videoWidth;
                    const videoHeight = videoElement.videoHeight;
                    
                    if (videoWidth && videoHeight) {
                        const canvasRatio = canvas.width / canvas.height;
                        const videoRatio = videoWidth / videoHeight;
                        
                        let drawWidth = canvas.width;
                        let drawHeight = canvas.height;
                        let x = 0;
                        let y = 0;
                        
                        if (videoRatio > canvasRatio) {
                            // El video es más ancho que el canvas (limitar altura, centrar verticalmente)
                            drawHeight = canvas.width / videoRatio;
                            y = (canvas.height - drawHeight) / 2;
                        } else {
                            // El video es más alto que el canvas (limitar anchura, centrar horizontalmente)
                            drawWidth = canvas.height * videoRatio;
                            x = (canvas.width - drawWidth) / 2;
                        }
                        
                        ctx.fillStyle = invertBackgroundRef.current ? '#ffffff' : '#000000';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(videoElement, x, y, drawWidth, drawHeight);
                    } else {
                        ctx.fillStyle = invertBackgroundRef.current ? '#ffffff' : '#000000';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    }
                } else {
                    // Sin video: color de fondo plano (exactamente como en la presentación)
                    ctx.fillStyle = invertBackgroundRef.current ? '#ffffff' : '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // Buscar letra activa usando exactamente la misma lógica de SecondScreen.tsx
                const mostRecentBlock = lyricsRef.current
                    .filter(l => l.startTime !== null && l.startTime <= t)
                    .sort((a, b) => b.startTime! - a.startTime!)[0];
                    
                let activeBlock = mostRecentBlock as any;
                if (activeBlock && activeBlock.endTime && activeBlock.endTime < t) {
                    activeBlock = undefined;
                }

                if (activeBlock && activeBlock.text) {
                    const text: string = activeBlock.text;
                    const font = lyricsSettingsRef.current.fontFamily.split(',')[0].trim().replace(/['"]/g, '') || 'Montserrat';
                    const baseSize = lyricsSettingsRef.current.fontSize || 60;
                    
                    // Escalar proporcionalmente al canvas (base en 720p)
                    const scaleFactor = canvas.height / 720;
                    const fontSize = baseSize * scaleFactor;
                    ctx.font = `bold ${fontSize}px ${font}, sans-serif`;
                    
                    let y = canvas.height * 0.8; // bottom (80%)
                    if (lyricsSettingsRef.current.position === 'top') {
                        y = canvas.height * 0.2; // top (20%)
                    } else if (lyricsSettingsRef.current.position === 'middle') {
                        y = canvas.height * 0.5; // middle (50%)
                    }

                    let x = canvas.width * 0.5; // center (50%)
                    ctx.textAlign = 'center';
                    if (lyricsSettingsRef.current.align === 'left') {
                        x = canvas.width * 0.1; // left (10%)
                        ctx.textAlign = 'left';
                    } else if (lyricsSettingsRef.current.align === 'right') {
                        x = canvas.width * 0.9; // right (90%)
                        ctx.textAlign = 'right';
                    }

                    // --- EFECTOS Y ANIMACIONES ---
                    const elapsed = t - (activeBlock.startTime || 0);
                    let animScale = 1.0;
                    let animTranslateY = 0;

                    // 1. Animación de Entrada
                    if (elapsed < 0.4 && lyricsSettingsRef.current.animation === 'zoom-in') {
                        const progress = elapsed / 0.4;
                        const easeOut = 1 - Math.pow(1 - progress, 3);
                        animScale = 0.85 + easeOut * 0.15;
                    } else if (elapsed < 0.5 && lyricsSettingsRef.current.animation === 'slide-up') {
                        const progress = elapsed / 0.5;
                        const easeOut = 1 - Math.pow(1 - progress, 3);
                        animTranslateY = 30 * (1 - easeOut) * scaleFactor;
                    }

                    // 2. Animación de Espera (Idle)
                    if (lyricsSettingsRef.current.idleAnimation === 'zoom-in-slow') {
                        const progress = Math.min(1.0, elapsed / 15.0);
                        animScale *= (1.0 + progress * 0.15);
                    } else if (lyricsSettingsRef.current.idleAnimation === 'zoom-out-slow') {
                        const progress = Math.min(1.0, elapsed / 15.0);
                        animScale *= (1.0 - progress * 0.15);
                    } else if (lyricsSettingsRef.current.idleAnimation === 'float-pulse-shine') {
                        // Flotante + Pulso (ciclo de 4s)
                        const progress = (Math.sin((elapsed / 4) * 2 * Math.PI - Math.PI / 2) + 1) / 2;
                        animTranslateY += progress * -10 * scaleFactor;
                        animScale *= (1.0 + progress * 0.02);
                    }

                    // Aplicar las transformaciones relativas al centro del texto
                    ctx.save();
                    ctx.translate(x, y + animTranslateY);
                    ctx.scale(animScale, animScale);

                    ctx.textBaseline = 'middle';

                    const lines = text.split('\n');
                    const lineHeight = fontSize * 1.25;
                    const startY = -((lines.length - 1) * lineHeight) / 2; // Relativo al centro

                    lines.forEach((line, idx) => {
                        const lineY = startY + idx * lineHeight;

                        if (!invertBackgroundRef.current) {
                            // Sombra idéntica al CSS de la pantalla de presentación (fondo oscuro/video)
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            ctx.shadowBlur = 8 * scaleFactor;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 4 * scaleFactor;
                        } else {
                            // Sin sombra (fondo claro/invertido)
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 0;
                        }

                        ctx.fillStyle = invertBackgroundRef.current ? '#000000' : '#ffffff';

                        let drawX = 0;
                        if (lyricsSettingsRef.current.align === 'left') {
                            ctx.textAlign = 'left';
                            drawX = -canvas.width * 0.4; // Ajuste relativo al centro (50% -> 10% = -40%)
                        } else if (lyricsSettingsRef.current.align === 'right') {
                            ctx.textAlign = 'right';
                            drawX = canvas.width * 0.4; // Ajuste relativo al centro (50% -> 90% = +40%)
                        } else {
                            ctx.textAlign = 'center';
                            drawX = 0;
                        }

                        ctx.fillText(line, drawX, lineY);

                        // Resetear sombra
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 0;
                    });

                    ctx.restore();
                }

                const progress = Math.min(100, Math.floor((t / dur) * 100));
                setExportProgress(progress);
                setExportStatus(`Exportando video... ${progress}% (${Math.floor(t)}s / ${Math.floor(dur)}s)`);

                if (t >= dur) {
                    recorder.stop();
                } else {
                    animationFrameId = requestAnimationFrame(drawFrame);
                }
            };

            const cleanup = () => {
                cancelAnimationFrame(animationFrameId);
                try { masterGainRef.current?.disconnect(dest); } catch(e) {}
                combinedStream.getTracks().forEach(track => track.stop());
                cancelExportRef.current = null;
            };

            cancelExportRef.current = () => {
                cleanup();
                setIsExporting(false);
                isExportingRef.current = false;
                stop();
            };

            recorder.onstop = () => {
                cleanup();

                const isCancelled = !isExportingRef.current;
                if (isCancelled) return;

                const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'mp4';
                const fileType = selectedMimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
                const blob = new Blob(chunks, { type: fileType });
                
                const activeSong = playlistRef.current.find(s => s.id === activeSongIdRef.current);
                const title = activeSong ? activeSong.title : 'video-mix';
                const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.${extension}`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                setIsExporting(false);
                isExportingRef.current = false;
                stop();
            };

            recorder.start();

            seek(0);
            togglePlay();

            animationFrameId = requestAnimationFrame(drawFrame);

        } catch (error) {
            console.error("Error al exportar video:", error);
            alert("Ocurrió un error al exportar el video.");
            setIsExporting(false);
            isExportingRef.current = false;
            stop();
        }
    }, [seek, togglePlay, stop]);

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
                
                if (!audioContextRef.current) {
                    const file = new File([blob], `VOZ GRABADA - ${new Date().toISOString().replace(/:/g, '-')}.webm`, { type: 'audio/webm' });
                    await addTrack(file, "VOZ GRABADA");
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const originalBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                    
                    const recStartCtxTime = recStartCtxTimeRef.current;
                    const recStartTimeRefValue = recStartTimeRefValueRef.current;
                    const recPlaybackRate = recPlaybackRateRef.current;
                    const latencyCompSec = recordingLatencyRef.current / 1000;
                    
                    const recTimelineStart = (recStartCtxTime - recStartTimeRefValue) * recPlaybackRate;
                    const targetStartTime = recTimelineStart - latencyCompSec;
                    
                    const sampleRate = originalBuffer.sampleRate;
                    const startOffsetSamples = Math.round(targetStartTime * sampleRate);
                    
                    let finalBuffer: AudioBuffer;
                    
                    if (startOffsetSamples > 0) {
                        const newLength = originalBuffer.length + startOffsetSamples;
                        finalBuffer = audioContextRef.current.createBuffer(
                            originalBuffer.numberOfChannels,
                            newLength,
                            sampleRate
                        );
                        for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
                            const originalData = originalBuffer.getChannelData(channel);
                            const finalData = finalBuffer.getChannelData(channel);
                            finalData.set(originalData, startOffsetSamples);
                        }
                    } else if (startOffsetSamples < 0) {
                        const cropSamples = -startOffsetSamples;
                        if (cropSamples >= originalBuffer.length) {
                            finalBuffer = audioContextRef.current.createBuffer(
                                originalBuffer.numberOfChannels,
                                1,
                                sampleRate
                            );
                        } else {
                            const newLength = originalBuffer.length - cropSamples;
                            finalBuffer = audioContextRef.current.createBuffer(
                                originalBuffer.numberOfChannels,
                                newLength,
                                sampleRate
                            );
                            for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
                                const originalData = originalBuffer.getChannelData(channel);
                                const finalData = finalBuffer.getChannelData(channel);
                                finalData.set(originalData.subarray(cropSamples), 0);
                            }
                        }
                    } else {
                        finalBuffer = originalBuffer;
                    }
                    
                    const wavBlob = audioBufferToWav(finalBuffer);
                    const file = new File([wavBlob], `VOZ GRABADA - ${new Date().toISOString().replace(/:/g, '-')}.wav`, { type: 'audio/wav' });
                    
                    await addTrack(file, "VOZ GRABADA");
                } catch (e) {
                    console.error("Error processing/aligning recorded audio:", e);
                    const file = new File([blob], `VOZ GRABADA - ${new Date().toISOString().replace(/:/g, '-')}.webm`, { type: 'audio/webm' });
                    await addTrack(file, "VOZ GRABADA");
                } finally {
                    stream.getTracks().forEach(t => t.stop());
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            if (!isPlayingRef.current) {
                togglePlay();
            }
            
            recStartCtxTimeRef.current = audioContextRef.current ? audioContextRef.current.currentTime : 0;
            recStartTimeRefValueRef.current = startTimeRef.current;
            recPlaybackRateRef.current = playbackRateRef.current;
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

    useEffect(() => {
        stopRecordingRef.current = stopRecording;
    }, [stopRecording]);

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
            tracks, isPlaying, currentTime, duration, setDuration, addTrack, addVideoTrack, removeTrack, clearTracks, togglePlay, stop, seek, setTrackVolume, setTrackPan, toggleTrackMute, toggleTrackSolo, setVideoElement: (el) => { videoRef.current = el; }, masterVolume, setMasterVolume, playlist, setPlaylist, activeSongId, addSongToPlaylist, removeSongFromPlaylist, updateSongInPlaylist, loadSong, loadPreparedSong, updateActiveSongCache, prepareSongCache, exportPreset, importPreset, videoDuration, trimVideoToAudio, videoOffset, setVideoOffset, videoEndTime, setVideoEndTime, videoFadeIn, setVideoFadeIn, videoFadeOut, setVideoFadeOut, videoFadeInType, setVideoFadeInType, videoFadeOutType, setVideoFadeOutType, videoOpacity, cutRegions, setCutRegions, splitPoints, setSplitPoints, addCutRegion, removeCutRegion, revertVideo, isInCutRegion, lyrics, setLyrics, addLyricBlock: (b) => setLyrics(p => [...p, {...b, id: crypto.randomUUID()}]), updateLyricBlock: (id, u) => setLyrics(p => p.map(l => l.id === id ? {...l, ...u} : l)), removeLyricBlock: (id) => setLyrics(p => p.filter(l => l.id !== id)), clearLyrics: () => setLyrics([]), lyricsSettings, setLyricsSettings, invertBackground, setInvertBackground, showLyrics, setShowLyrics, panelSizes, setPanelSizes, layoutVersion, loadingProgress, songAnalysis, getMasterLevels, getTrackLevel, isUploading, setIsUploading, uploadMessage, setUploadMessage, processZipFile, processVideoFile: async (f) => { await addVideoTrack(f); }, sections, setSections, pitchShift, setPitchShift, playbackRate, setPlaybackRate,
            customChords, setCustomChords, addChordBlock: (b) => setCustomChords(p => [...p, {...b, id: crypto.randomUUID()}]), updateChordBlock: (id, u) => setCustomChords(p => p.map(c => c.id === id ? {...c, ...u} : c)), removeChordBlock: (id) => setCustomChords(p => p.filter(c => c.id !== id)), clearChords: () => setCustomChords([]),
            audioOutputDeviceId, audioOutputMaxChannels, setAudioOutputDevice, setTrackOutputChannel,
            isRecording, startRecording, stopRecording, downloadTrack, getRecordingTimeDomainData,
            isCountInEnabled, setIsCountInEnabled: handleSetIsCountInEnabled, countInClicks, setCountInClicks: handleSetCountInClicks, isCountingIn, currentCountInBeat,
            countInOutputChannel, setCountInOutputChannel: handleSetCountInOutputChannel,
            recordingLatency, setRecordingLatency: handleSetRecordingLatency,
            isExporting, exportProgress, exportStatus, exportMixToMp3, exportMixToMp4, cancelExport
        }}>
            {children}
        </AudioEngineContext.Provider>
    );
};
