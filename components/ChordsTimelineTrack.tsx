import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioEngine, ChordBlock } from '@/hooks/useAudioEngine';
import { generateSectionProgression, transposeChord } from '@/utils/chordShapes';

const ALL_CHORDS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm',
    'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5',
];

export const ChordsTimelineTrack: React.FC = () => {
    const engine = useAudioEngine();
    const {
        customChords, setCustomChords, addChordBlock, updateChordBlock, removeChordBlock,
        duration, currentTime, sections, songAnalysis, seek, pitchShift
    } = engine;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const dragStartX = useRef<number>(0);
    const initialTimes = useRef<Map<string, { start: number; end: number }>>(new Map());
    const resizeInitialEndTime = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    const safeDuration = duration || 0;

    // ── Auto-initialize chords from section progressions on first load ─────────
    useEffect(() => {
        if (customChords.length > 0 || safeDuration <= 0) return;

        const keyDisplay = songAnalysis?.keyDisplay || 'C';
        const bpm = songAnalysis?.bpm || 120;
        const timeSig = songAnalysis?.timeSignature || '4/4';
        const beatsPerMeasure = parseInt(timeSig.split('/')[0]) || 4;
        const chordDuration = (60 / bpm) * beatsPerMeasure * 2; // 2 measures per chord

        const newChords: Omit<ChordBlock, 'id'>[] = [];

        if (sections && sections.length > 0) {
            const sortedSections = [...sections].sort((a, b) => a.start - b.start);
            sortedSections.forEach(section => {
                const sectionChords = generateSectionProgression(keyDisplay, section.label);
                const sectionDuration = section.end - section.start;
                const count = Math.ceil(sectionDuration / chordDuration);
                for (let i = 0; i < count; i++) {
                    const startTime = section.start + i * chordDuration;
                    if (startTime >= section.end) break;
                    newChords.push({
                        chord: sectionChords[i % sectionChords.length],
                        startTime,
                        endTime: Math.min(section.end, startTime + chordDuration),
                    });
                }
            });
        } else {
            const defaultChords = generateSectionProgression(keyDisplay, '');
            const totalCount = Math.ceil(safeDuration / chordDuration);
            for (let i = 0; i < totalCount; i++) {
                newChords.push({
                    chord: defaultChords[i % defaultChords.length],
                    startTime: i * chordDuration,
                    endTime: Math.min(safeDuration, (i + 1) * chordDuration),
                });
            }
        }

        setCustomChords(newChords.map(c => ({ ...c, id: crypto.randomUUID() })));
    }, [safeDuration, customChords.length, songAnalysis, sections]);

    // ── Drag / Resize mouse handlers ───────────────────────────────────────────
    useEffect(() => {
        if (!draggingId && !resizingId) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || safeDuration <= 0) return;
            const rect = containerRef.current.getBoundingClientRect();
            const deltaX = e.clientX - dragStartX.current;
            const deltaTime = (deltaX / rect.width) * safeDuration;

            if (draggingId) {
                const init = initialTimes.current.get(draggingId);
                if (init) {
                    const dur = init.end - init.start;
                    const newStart = Math.max(0, Math.min(init.start + deltaTime, safeDuration - dur));
                    seek(newStart);
                }

                setCustomChords(prev => prev.map(c => {
                    if (selectedIds.has(c.id)) {
                        const cInit = initialTimes.current.get(c.id);
                        if (cInit) {
                            const dur = cInit.end - cInit.start;
                            const newStart = Math.max(0, Math.min(cInit.start + deltaTime, safeDuration - dur));
                            return { ...c, startTime: newStart, endTime: newStart + dur };
                        }
                    }
                    return c;
                }));
            } else if (resizingId) {
                const block = customChords.find(c => c.id === resizingId);
                if (block) {
                    const newEnd = Math.max(block.startTime + 0.1, Math.min(resizeInitialEndTime.current + deltaTime, safeDuration));
                    seek(newEnd);
                    updateChordBlock(resizingId, { endTime: newEnd });
                }
            }
        };

        const handleMouseUp = () => {
            setDraggingId(null);
            setResizingId(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, resizingId, safeDuration, selectedIds, customChords, updateChordBlock, seek]);

    // ── Focus edit input when opened ───────────────────────────────────────────
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleAddAtPlayhead = useCallback(() => {
        if (safeDuration <= 0) return;
        const bpm = songAnalysis?.bpm || 120;
        const timeSig = songAnalysis?.timeSignature || '4/4';
        const beatsPerMeasure = parseInt(timeSig.split('/')[0]) || 4;
        const dur = (60 / bpm) * beatsPerMeasure * 2;
        addChordBlock({
            chord: 'C',
            startTime: currentTime,
            endTime: Math.min(safeDuration, currentTime + dur),
        });
    }, [safeDuration, currentTime, songAnalysis, addChordBlock]);

    const handleClearAll = useCallback(() => {
        if (confirm('¿Eliminar todos los acordes de la pista?')) {
            setCustomChords([]);
        }
    }, [setCustomChords]);

    const commitEdit = () => {
        if (editingId && editValue.trim()) {
            updateChordBlock(editingId, { chord: editValue.trim() });
        }
        setEditingId(null);
        setEditValue('');
    };

    if (safeDuration <= 0) return null;

    return (
        <div
            ref={containerRef}
            className="border-b border-gray-700 relative flex flex-col shrink-0 overflow-hidden h-full bg-gray-900"
            onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set()); }}
            onMouseDown={(e) => { e.stopPropagation(); }}
        >
            {/* Track label + controls */}
            <div className="absolute top-1 left-1 z-20 flex items-center gap-1.5 pointer-events-none">
                <div className="bg-emerald-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-emerald-300 font-bold">
                    ACORDES
                </div>
            </div>
            <div className="absolute top-1 right-1 z-20 flex items-center gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); handleAddAtPlayhead(); }}
                    className="bg-emerald-700/80 hover:bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors"
                    title="Agregar acorde en la posición actual"
                >
                    + Acorde
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
                    className="bg-gray-700/80 hover:bg-red-700/80 text-gray-300 hover:text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors"
                    title="Limpiar todos los acordes"
                >
                    ✕
                </button>
            </div>

            {/* Chord blocks */}
            <div className="relative w-full h-full">
                {customChords.map((block) => {
                    const leftPct = (block.startTime / safeDuration) * 100;
                    const widthPct = ((block.endTime - block.startTime) / safeDuration) * 100;
                    const isSelected = selectedIds.has(block.id);
                    const isDragging = draggingId && selectedIds.has(block.id);
                    const isResizing = resizingId === block.id;
                    const isEditing = editingId === block.id;

                    return (
                        <div
                            key={block.id}
                            className={`absolute top-1 bottom-1 flex items-center px-1 sm:px-2 py-0.5 rounded border text-[9px] sm:text-[10px] whitespace-nowrap overflow-hidden z-10 transition-colors select-none
                                ${isDragging || isResizing || isSelected
                                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/50 z-30'
                                    : 'bg-emerald-900/50 border-emerald-700/50 hover:bg-emerald-800/80 hover:border-emerald-500 text-emerald-200 hover:z-30'
                                }`}
                            style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(widthPct, 0.5)}%`,
                                minWidth: '24px',
                            }}
                        >
                            {/* Left accent */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 opacity-60 pointer-events-none rounded-l" />

                            {/* Drag body */}
                            <div
                                className="absolute inset-y-0 left-0 right-2 cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (isEditing) return;
                                    let newSel = new Set(selectedIds);
                                    if (e.ctrlKey || e.metaKey) {
                                        newSel.has(block.id) ? newSel.delete(block.id) : newSel.add(block.id);
                                    } else {
                                        if (!newSel.has(block.id)) newSel = new Set([block.id]);
                                    }
                                    setSelectedIds(newSel);
                                    seek(block.startTime);

                                    if (newSel.has(block.id)) {
                                        setDraggingId(block.id);
                                        dragStartX.current = e.clientX;
                                        const initMap = new Map<string, { start: number; end: number }>();
                                        customChords.forEach(c => {
                                            if (newSel.has(c.id)) initMap.set(c.id, { start: c.startTime, end: c.endTime });
                                        });
                                        initialTimes.current = initMap;
                                    }
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(block.id);
                                    setEditValue(block.chord);
                                }}
                            />

                            {/* Resize handle (right edge) */}
                            <div
                                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/20 transition-colors z-40"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizingId(block.id);
                                    dragStartX.current = e.clientX;
                                    resizeInitialEndTime.current = block.endTime;
                                }}
                            />

                            {/* Delete button on selected */}
                            {isSelected && !isDragging && (
                                <button
                                    className="absolute top-0 right-2 text-[7px] text-red-300 hover:text-red-100 z-50 leading-none px-0.5"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeChordBlock(block.id);
                                        setSelectedIds(prev => { const s = new Set(prev); s.delete(block.id); return s; });
                                    }}
                                    title="Eliminar acorde"
                                >
                                    ✕
                                </button>
                            )}

                            {/* Chord label or edit input */}
                            {isEditing ? (
                                <input
                                    ref={editInputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitEdit();
                                        if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                                        e.stopPropagation();
                                    }}
                                    list="chord-suggestions"
                                    className="absolute inset-0 bg-gray-900 text-emerald-300 font-bold font-mono text-[10px] text-center outline-none border-0 rounded px-1 w-full z-50"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="truncate pl-1.5 leading-tight font-bold font-mono text-[10px] drop-shadow-md pointer-events-none">
                                    {transposeChord(block.chord, pitchShift)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Datalist for chord suggestions */}
            <datalist id="chord-suggestions">
                {ALL_CHORDS.map(c => <option key={c} value={c} />)}
            </datalist>
        </div>
    );
};
