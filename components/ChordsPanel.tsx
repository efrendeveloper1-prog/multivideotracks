import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { ChordDiagram } from './ChordDiagram';
import { generateSectionProgression, transposeChord, transposeKey } from '@/utils/chordShapes';

type Instrument = 'guitar' | 'piano';

interface ChordsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const ALL_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
];

export const ChordsPanel: React.FC<ChordsPanelProps> = ({ isOpen, onClose }) => {
    const { songAnalysis, currentTime, duration, sections, pitchShift, seek, activeSongId, customChords } = useAudioEngine();
    const [instrument, setInstrument] = useState<Instrument>('guitar');
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync settings: BPM, Offset, and Base Key
    const [manualBpm, setManualBpm] = useState<number>(120);
    const [offset, setOffset] = useState<number>(0);
    const [manualKey, setManualKey] = useState<string>('C');

    // Load persisted sync settings when the active song changes
    useEffect(() => {
        const defaultBpm = songAnalysis?.bpm || 120;
        const defaultKey = songAnalysis?.keyDisplay || 'C';
        if (activeSongId) {
            const saved = localStorage.getItem(`chords_sync_${activeSongId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setManualBpm(parsed.bpm || defaultBpm);
                    setOffset(parsed.offset || 0);
                    setManualKey(parsed.key || defaultKey);
                    return;
                } catch (e) {}
            }
        }
        setManualBpm(defaultBpm);
        setOffset(0);
        setManualKey(defaultKey);
    }, [activeSongId, songAnalysis?.bpm, songAnalysis?.keyDisplay]);

    // Save sync settings to localStorage
    const saveSyncSettings = (newBpm: number, newOffset: number, newKey: string) => {
        if (activeSongId) {
            localStorage.setItem(
                `chords_sync_${activeSongId}`,
                JSON.stringify({ bpm: newBpm, offset: newOffset, key: newKey })
            );
        }
    };

    const handleBpmChange = (val: number) => {
        const cleanVal = Math.max(1, Math.min(300, val || 120));
        setManualBpm(cleanVal);
        saveSyncSettings(cleanVal, offset, manualKey);
    };

    const handleOffsetChange = (val: number) => {
        const cleanVal = Math.max(-10, Math.min(10, Math.round(val * 100) / 100));
        setOffset(cleanVal);
        saveSyncSettings(manualBpm, cleanVal, manualKey);
    };

    const handleKeyChange = (val: string) => {
        setManualKey(val);
        saveSyncSettings(manualBpm, offset, val);
    };

    // Transposed key for display in header
    const transposedKey = useMemo(() => {
        return transposeKey(manualKey, pitchShift);
    }, [manualKey, pitchShift]);

    // Calculate chord duration based on the manually tuned BPM
    const chordDuration = useMemo(() => {
        const bpm = manualBpm || songAnalysis?.bpm || 120;
        const timeSignature = songAnalysis?.timeSignature || '4/4';
        const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;
        const beatsPerChord = beatsPerMeasure * 2; // change chord every 2 measures
        const beatDuration = 60 / bpm;
        return beatDuration * beatsPerChord;
    }, [manualBpm, songAnalysis?.bpm, songAnalysis?.timeSignature]);

    // Generate chord events continuously from customChords, falling back to auto-generated if empty
    const chordEvents = useMemo(() => {
        if (customChords && customChords.length > 0) {
            const sortedChords = [...customChords].sort((a, b) => a.startTime - b.startTime);
            return sortedChords.map((c, index) => ({
                chord: c.chord,
                startTime: c.startTime,
                endTime: c.endTime,
                globalIndex: index
            }));
        }

        const safeChordDuration = (chordDuration > 0 && isFinite(chordDuration)) ? chordDuration : 4.0;
        const effectiveDuration = duration > 0 ? duration : 300;
        const events = [];
        let timeCursor = 0;
        let globalIndex = 0;

        while (timeCursor < effectiveDuration) {
            // Safety loop breaker
            if (globalIndex > 5000) break;

            const actualTime = timeCursor + offset;
            const currentSection = sections?.find(s => actualTime >= s.start && actualTime < s.end);
            
            // Get the chord progression list for the current section type (or fallback to general progression)
            const sectionChords = generateSectionProgression(manualKey, currentSection ? currentSection.label : '');

            let chordName = 'C';
            if (currentSection) {
                // Align chord changes with the start of the section
                const relativeTime = actualTime - currentSection.start;
                const sectionChordIdx = Math.floor(relativeTime / safeChordDuration);
                chordName = sectionChords[sectionChordIdx % sectionChords.length];
            } else {
                // Default continuous progression loop when not in any section
                const loopIdx = Math.floor(timeCursor / safeChordDuration);
                chordName = sectionChords[loopIdx % sectionChords.length];
            }

            const startTime = timeCursor + offset;
            const endTime = Math.min(effectiveDuration, timeCursor + safeChordDuration + offset);

            events.push({
                chord: chordName,
                startTime,
                endTime,
                globalIndex
            });

            globalIndex++;
            timeCursor += safeChordDuration;
        }

        return events;
    }, [customChords, duration, chordDuration, sections, offset, manualKey]);

    // Find the active chord event and its progress
    const activeEvent = useMemo(() => {
        if (chordEvents.length === 0) return null;
        const event = chordEvents.find(e => currentTime >= e.startTime && currentTime < e.endTime);
        if (event) return event;

        // If not inside any event, find the most recent one that ended
        const pastEvents = chordEvents.filter(e => e.endTime <= currentTime);
        if (pastEvents.length > 0) {
            return pastEvents[pastEvents.length - 1];
        }

        return chordEvents[0];
    }, [chordEvents, currentTime]);

    const activeGlobalIndex = activeEvent ? activeEvent.globalIndex : 0;

    const activeProgress = useMemo(() => {
        if (!activeEvent) return 0;
        const elapsed = currentTime - activeEvent.startTime;
        const total = activeEvent.endTime - activeEvent.startTime;
        if (total <= 0) return 0;
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }, [activeEvent, currentTime]);

    if (!isOpen || !mounted) return null;

    // Card width (160px) + Gap (24px) = 184px spacing
    const cardSpacing = 184;
    const cardHalfWidth = 80;

    return createPortal(
        <>
            {/* Backdrop for closing */}
            <div
                className={`fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Panel / Modal */}
            <div
                className={`
                    fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]
                    w-[90vw] max-w-4xl bg-gray-900/95 backdrop-blur-md
                    border border-gray-700 rounded-2xl
                    shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]
                    transition-all duration-300 ease-out
                    flex flex-col overflow-hidden
                    ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                `}
                style={{ maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-2 border-b border-gray-700/60">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Instrument toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs font-bold">
                            <button
                                className={`px-3 py-1 transition-colors flex items-center gap-1 ${
                                    instrument === 'guitar'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                                onClick={() => setInstrument('guitar')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.59 3a2 2 0 0 0-2.83 0l-1.46 1.46a3.87 3.87 0 0 0-4.33.89L9.5 6.83a1 1 0 0 0 0 1.41l6.26 6.26a1 1 0 0 0 1.41 0l1.48-1.47a3.87 3.87 0 0 0 .89-4.33L21 7.24a2 2 0 0 0 0-2.83zM5.5 15.5a3 3 0 0 0-3 3v.09A2.91 2.91 0 0 0 5.41 21h.09a3 3 0 0 0 2.12-5.12L6.5 14.77a3 3 0 0 0-1-.27z"/>
                                </svg>
                                Guitarra
                            </button>
                            <button
                                className={`px-3 py-1 transition-colors flex items-center gap-1 ${
                                    instrument === 'piano'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                                onClick={() => setInstrument('piano')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 3H4v18h16V3zm-2 16H6V5h12v14zm-8-6H8v4h2v-4zm4 0h-2v4h2v-4zm4 0h-2v4h2v-4zm-4-6H8V9h2V7zm4 0h-2v2h2V7zm4 0h-2v2h2V7z"/>
                                </svg>
                                Piano
                            </button>
                        </div>

                        {/* Key manual selector */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400">
                            <span className="font-semibold">Tono Base:</span>
                            <select
                                value={manualKey}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                className="bg-gray-900 border border-gray-750 text-white rounded font-mono text-[10px] outline-none focus:border-emerald-500 py-0.5 px-1"
                            >
                                {ALL_KEYS.map(k => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
                            {pitchShift !== 0 && (
                                <span className="text-[10px] text-emerald-400 font-bold ml-1">
                                    → {transposedKey}
                                </span>
                            )}
                        </div>

                        {/* BPM manual setting */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400">
                            <span className="font-semibold">BPM:</span>
                            <input
                                type="number"
                                value={manualBpm}
                                onChange={(e) => handleBpmChange(Number(e.target.value))}
                                className="w-12 bg-gray-900 border border-gray-700 text-white rounded text-center font-mono focus:border-emerald-500 outline-none text-[10px] py-0.5"
                            />
                        </div>

                        {/* Offset manual setting */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400">
                            <span className="font-semibold">Desfase:</span>
                            <button
                                onClick={() => handleOffsetChange(offset - 0.05)}
                                className="w-4 h-4 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold"
                            >
                                -
                            </button>
                            <span className="w-14 text-center font-mono text-white text-[10px]">
                                {offset >= 0 ? '+' : ''}{offset.toFixed(2)}s
                            </span>
                            <button
                                onClick={() => handleOffsetChange(offset + 0.05)}
                                className="w-4 h-4 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold"
                            >
                                +
                            </button>
                        </div>

                        {activeEvent && (
                            <span className="text-[9px] text-gray-500 font-mono">
                                Compás {Math.floor(currentTime / (chordDuration / 2)) + 1} • Acorde {activeGlobalIndex + 1}/{chordEvents.length}
                            </span>
                        )}
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Cerrar acordes"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* Carousel Container */}
                <div 
                    ref={containerRef}
                    className="relative w-full h-[260px] overflow-hidden flex items-center justify-center bg-gray-950/70 py-4 select-none"
                >
                    {/* Visual Center Highlight Frame (matching the user's uploaded reference image active card frame) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[184px] h-[230px] border border-emerald-500/30 rounded-2xl pointer-events-none bg-emerald-500/[0.01] shadow-[0_0_30px_rgba(16,185,129,0.06)] z-10" />

                    {/* Sliding filmstrip */}
                    <div 
                        className="flex items-center gap-6 transition-transform duration-500 ease-out h-full flex-nowrap"
                        style={{
                            transform: `translateX(calc(50% - ${activeGlobalIndex * cardSpacing + cardHalfWidth}px))`
                        }}
                    >
                        {chordEvents.map((event, index) => {
                            const isSelfActive = index === activeGlobalIndex;
                            const distance = Math.abs(index - activeGlobalIndex);

                            // Transpose chord name in real-time
                            const transposedChordName = transposeChord(event.chord, pitchShift);

                            return (
                                <div
                                    key={`${event.chord}-${index}`}
                                    onClick={() => seek(event.startTime)}
                                    className={`
                                        flex-shrink-0 cursor-pointer transition-all duration-500 ease-out
                                        ${isSelfActive ? 'w-[160px] scale-[1.10] opacity-100 z-20' : 'w-[160px] scale-90 opacity-40 hover:opacity-75 z-0'}
                                    `}
                                >
                                    {/* Card content wrapper */}
                                    <div className={`
                                        relative flex flex-col items-center justify-center p-4 rounded-xl h-[200px]
                                        bg-gray-900/90 border transition-all duration-300
                                        ${isSelfActive ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-gray-900/95' : 'border-gray-800/80 bg-gray-900/40'}
                                    `}>
                                        {/* Diagram */}
                                        <div className="flex-1 flex items-center justify-center w-full min-h-0">
                                            {distance <= 2 ? (
                                                <ChordDiagram 
                                                    chordName={transposedChordName}
                                                    instrument={instrument}
                                                    isActive={isSelfActive}
                                                    size={isSelfActive ? 'md' : 'sm'}
                                                />
                                            ) : (
                                                <div className="text-xl font-bold font-mono text-gray-500">
                                                    {transposedChordName}
                                                </div>
                                            )}
                                        </div>

                                        {/* Real-time Chord Progress Bar (only on active card) */}
                                        {isSelfActive && (
                                            <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden mt-3">
                                                <div 
                                                    className="bg-emerald-500 h-full rounded-full transition-all duration-100 ease-linear"
                                                    style={{ width: `${activeProgress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};
