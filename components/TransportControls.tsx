import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { ChordsPanel } from './ChordsPanel';
import { transposeKey } from '@/utils/chordShapes';


export const TransportControls: React.FC = () => {
    const [isEditingTempo, setIsEditingTempo] = useState(false);
    const [tempoInputValue, setTempoInputValue] = useState("");
    const [showChords, setShowChords] = useState(false);

    const {
        isPlaying,
        togglePlay,
        stop,
        currentTime,
        duration,
        masterVolume,
        setMasterVolume,
        songAnalysis,
        playlist,
        activeSongId,
        loadSong,
        pitchShift,
        setPitchShift,
        playbackRate,
        setPlaybackRate,
        isRecording,
        startRecording,
        stopRecording
    } = useAudioEngine();

    // Setup Spacebar keyboard shortcut for Play/Pause
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay]);

    // Playlist Navigation Logic
    const currentIndex = playlist.findIndex(s => s.id === activeSongId);

    const handlePrev = () => {
        if (currentIndex > 0) {
            loadSong(playlist[currentIndex - 1].id);
        }
    };

    const handleNext = () => {
        if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
            loadSong(playlist[currentIndex + 1].id);
        }
    };

    // Formatting helper
    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const bpmDisplay = songAnalysis?.bpm || '--';
    
    // Read user-corrected key if saved in localStorage, otherwise fall back to analyzed key
    const [correctedKey, setCorrectedKey] = useState<string>('--');

    useEffect(() => {
        const defaultKey = songAnalysis?.keyDisplay || '--';
        if (activeSongId) {
            const saved = localStorage.getItem(`chords_sync_${activeSongId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.key) {
                        setCorrectedKey(parsed.key);
                        return;
                    }
                } catch (e) {}
            }
        }
        setCorrectedKey(defaultKey);
    }, [activeSongId, songAnalysis?.keyDisplay, showChords]);

    const keyDisplay = correctedKey !== '--' ? transposeKey(correctedKey, pitchShift) : '--';
    const timeSigDisplay = songAnalysis?.timeSignature || '4/4';



    // Pitch Options Logic
    const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    const getPitchOptions = () => {
        if (!songAnalysis?.keyDisplay) return [{ label: 'Normal (0)', value: 0 }];
        let root = songAnalysis.keyDisplay.split(' ')[0];
        if (root.length > 1 && root[1].toLowerCase() === 'm') root = root[0]; 
        
        let idx = SHARPS.indexOf(root);
        if (idx === -1) idx = FLATS.indexOf(root);
        if (idx === -1) return [{ label: `${root} (0)`, value: 0 }];
        
        const options = [];
        // Down 8
        for (let i = -8; i < 0; i++) {
            let noteIdx = (idx + i) % 12;
            if (noteIdx < 0) noteIdx += 12;
            options.push({ label: `${FLATS[noteIdx]} (${i})`, value: i });
        }
        // Original
        options.push({ label: `${root} (0)`, value: 0 });
        // Up 8
        for (let i = 1; i <= 8; i++) {
            let noteIdx = (idx + i) % 12;
            options.push({ label: `${SHARPS[noteIdx]} (+${i})`, value: i });
        }
        return options;
    };

    const pitchOptions = getPitchOptions();

    return (
        <div className="flex items-center justify-between bg-gray-800 p-2 sm:p-4 rounded-lg border border-gray-700 h-full">
            {/* Master Fader */}
            <div className="flex flex-col items-center mr-2 sm:mr-6 group relative shrink-0">
                <span className="text-[9px] sm:text-xs font-bold text-gray-400 mb-1">MASTER</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="w-20 sm:w-32 cursor-pointer"
                />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                {/* Previous Button */}
                <button
                    onClick={handlePrev}
                    disabled={currentIndex <= 0}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shadow-lg transition-colors
                        ${currentIndex > 0 ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-800' : 'bg-gray-800 opacity-50 cursor-not-allowed'}`}
                    title="Canción Anterior"
                >
                    <div className="flex -space-x-1 sm:-space-x-1">
                        <div className="w-0 h-0 border-t-[8px] sm:border-t-[10px] border-t-transparent border-r-[12px] sm:border-r-[16px] border-r-white border-b-[8px] sm:border-b-[10px] border-b-transparent"></div>
                        <div className="w-0 h-0 border-t-[8px] sm:border-t-[10px] border-t-transparent border-r-[12px] sm:border-r-[16px] border-r-white border-b-[8px] sm:border-b-[10px] border-b-transparent"></div>
                    </div>
                </button>

                <button
                    onClick={stop}
                    className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                    title="Stop"
                >
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-sm"></div>
                </button>

                <button
                    onClick={togglePlay}
                    className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 active:bg-gray-800 shadow-lg"
                    title="Play/Pause (Espacio)"
                >
                    {isPlaying ? (
                        <div className="flex gap-1.5">
                            <div className="w-2 h-6 sm:w-3 sm:h-7 bg-white rounded-sm"></div>
                            <div className="w-2 h-6 sm:w-3 sm:h-7 bg-white rounded-sm"></div>
                        </div>
                    ) : (
                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[20px] border-l-white border-b-[10px] border-b-transparent ml-1 sm:border-t-[12px] sm:border-l-[24px] sm:border-b-[12px]"></div>
                    )}
                </button>

                {/* Record Button */}
                <button
                    onClick={() => {
                        if (isRecording) {
                            stopRecording();
                            if (isPlaying) togglePlay();
                        } else {
                            startRecording();
                        }
                    }}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300
                        ${isRecording 
                            ? 'bg-red-600 hover:bg-red-500 animate-pulse shadow-red-900/50' 
                            : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-800 shadow-lg'}`}
                    title="Grabar Audio (Micrófono)"
                >
                    <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full transition-colors duration-300 ${isRecording ? 'bg-white' : 'bg-red-500'}`}></div>
                </button>

                {/* Next Button */}
                <button
                    onClick={handleNext}
                    disabled={currentIndex === -1 || currentIndex >= playlist.length - 1}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shadow-lg transition-colors
                        ${(currentIndex !== -1 && currentIndex < playlist.length - 1) ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-800' : 'bg-gray-800 opacity-50 cursor-not-allowed'}`}
                    title="Canción Siguiente"
                >
                    <div className="flex -space-x-1 sm:-space-x-1">
                        <div className="w-0 h-0 border-t-[8px] sm:border-t-[10px] border-t-transparent border-l-[12px] sm:border-l-[16px] border-l-white border-b-[8px] sm:border-b-[10px] border-b-transparent"></div>
                        <div className="w-0 h-0 border-t-[8px] sm:border-t-[10px] border-t-transparent border-l-[12px] sm:border-l-[16px] border-l-white border-b-[8px] sm:border-b-[10px] border-b-transparent"></div>
                    </div>
                </button>
            </div>

            {/* Song Info / LCD Display — clickable to toggle chords */}
            <div
                className={`relative flex-1 mx-2 sm:mx-4 bg-gray-900 px-3 py-2 rounded border font-mono text-green-400 flex flex-col items-end justify-center min-w-max shrink-0 transition-all duration-200 ${
                    songAnalysis
                        ? 'border-emerald-700/60 cursor-pointer hover:border-emerald-500 hover:bg-gray-800/80 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : 'border-gray-600 cursor-default'
                }`}
                onClick={() => songAnalysis && setShowChords(prev => !prev)}
                title={songAnalysis ? 'Clic para ver acordes' : ''}
            >
                <div className="text-base sm:text-xl md:text-2xl whitespace-nowrap">{fmt(currentTime)} / {fmt(duration)}</div>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs md:text-sm whitespace-nowrap">
                    <span className="text-gray-400">{timeSigDisplay} • {bpmDisplay} BPM</span>
                    {keyDisplay !== '--' && (
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] sm:text-[11px] transition-colors ${
                            showChords
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50'
                        }`}>
                            ♪ {keyDisplay}
                        </span>
                    )}
                </div>
                {/* Chords hint badge */}
                {songAnalysis && (
                    <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wide transition-all ${
                        showChords
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-400 opacity-80'
                    }`}>
                        {showChords ? '▲ acordes' : '▼ acordes'}
                    </div>
                )}
            </div>

            {/* Chords Panel (absolute, grows upward from footer) */}
            <div className="absolute bottom-full left-0 right-0 z-50">
                <ChordsPanel isOpen={showChords} onClose={() => setShowChords(false)} />
            </div>

            {/* Key & Tempo Controls */}
            <div className="flex flex-col gap-1 sm:gap-2 shrink-0">
                <div className={`flex items-center px-2 py-1 rounded text-[10px] sm:text-xs font-bold ${songAnalysis ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'bg-gray-700 text-gray-400'}`}>
                    <span className="mr-2">KEY:</span>
                    <select 
                        value={pitchShift} 
                        onChange={(e) => setPitchShift(Number(e.target.value))}
                        disabled={!songAnalysis}
                        className="bg-transparent outline-none cursor-pointer text-white flex-1"
                    >
                        {!songAnalysis && <option value={0}>--</option>}
                        {songAnalysis && pitchOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <button 
                        onClick={() => setPitchShift(0)} 
                        disabled={!songAnalysis || pitchShift === 0}
                        className={`ml-1 p-1 rounded hover:bg-green-800/50 transition-colors ${pitchShift === 0 ? 'opacity-30 cursor-default' : 'opacity-100 cursor-pointer text-white'}`}
                        title="Restablecer Tono"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                </div>
                <div className={`flex items-center px-2 py-1 rounded text-[10px] sm:text-xs font-bold ${songAnalysis ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50' : 'bg-gray-700 text-gray-400'}`}>
                    <span className="mr-2">TEMPO:</span>
                    <input 
                        type="range" 
                        min={Math.round((songAnalysis?.bpm || 120) * 0.5)} 
                        max={Math.round((songAnalysis?.bpm || 120) * 1.5)} 
                        step="1" 
                        value={Math.round((songAnalysis?.bpm || 120) * playbackRate)} 
                        onChange={(e) => setPlaybackRate(Number(e.target.value) / (songAnalysis?.bpm || 120))}
                        className="w-16 sm:w-20 cursor-pointer"
                        disabled={!songAnalysis}
                    />
                    {isEditingTempo ? (
                        <input
                            type="number"
                            className="ml-2 w-14 text-right bg-gray-800 text-white rounded outline-none border border-blue-500 px-1"
                            value={tempoInputValue}
                            onChange={(e) => setTempoInputValue(e.target.value)}
                            onBlur={() => {
                                const newBpm = parseFloat(tempoInputValue);
                                if (!isNaN(newBpm) && songAnalysis?.bpm) {
                                    setPlaybackRate(newBpm / songAnalysis.bpm);
                                }
                                setIsEditingTempo(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const newBpm = parseFloat(tempoInputValue);
                                    if (!isNaN(newBpm) && songAnalysis?.bpm) {
                                        setPlaybackRate(newBpm / songAnalysis.bpm);
                                    }
                                    setIsEditingTempo(false);
                                } else if (e.key === 'Escape') {
                                    setIsEditingTempo(false);
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <span 
                            className="ml-2 w-14 text-right cursor-text hover:text-blue-300 transition-colors"
                            onDoubleClick={() => {
                                if (songAnalysis) {
                                    setTempoInputValue(Math.round(songAnalysis.bpm * playbackRate).toString());
                                    setIsEditingTempo(true);
                                }
                            }}
                            title="Doble clic para editar"
                        >
                            {Math.round((songAnalysis?.bpm || 120) * playbackRate)} BPM
                        </span>
                    )}
                    <button 
                        onClick={() => setPlaybackRate(1)} 
                        disabled={!songAnalysis || playbackRate === 1}
                        className={`ml-1 p-1 rounded hover:bg-blue-800/50 transition-colors ${playbackRate === 1 ? 'opacity-30 cursor-default' : 'opacity-100 cursor-pointer text-white'}`}
                        title="Restablecer Tempo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
