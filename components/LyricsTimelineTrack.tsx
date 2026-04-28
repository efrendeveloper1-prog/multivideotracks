import React, { useState, useRef, useEffect } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const LyricsTimelineTrack: React.FC = () => {
    const { lyrics, updateLyricBlock, duration, editMode } = useAudioEngine() as any; // Cast locally since editMode isn't in engine but we want read-only or no-drag maybe. Let's not depend on editMode if we want always drag.
    // Wait, let's just use the strict type and allow drag always or handled manually.
    const engine = useAudioEngine();
    const safeLyrics = engine.lyrics || [];
    const safeDuration = engine.duration || 0;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingId, setResizingId] = useState<string | null>(null);
    const dragStartX = useRef<number>(0);
    const initialTime = useRef<number>(0);
    const initialTimes = useRef<Map<string, { start: number | null, end: number | null }>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    const mappedLyrics = safeLyrics.filter(l => l.startTime !== null);

    useEffect(() => {
        if (!draggingId && !resizingId) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || safeDuration <= 0) return;
            const rect = containerRef.current.getBoundingClientRect();
            const deltaX = e.clientX - dragStartX.current;
            const deltaTime = (deltaX / rect.width) * safeDuration;
            
            if (draggingId) {
                engine.setLyrics((prev: any) => prev.map((l: any) => {
                    if (selectedIds.has(l.id)) {
                        const initial = initialTimes.current.get(l.id);
                        if (initial && initial.start !== null) {
                            let newStart = initial.start + deltaTime;
                            newStart = Math.max(0, Math.min(newStart, safeDuration));
                            
                            let newEnd = l.endTime;
                            if (initial.end !== null) {
                                const duration = initial.end - initial.start;
                                newEnd = newStart + duration;
                            }
                            
                            return { ...l, startTime: newStart, endTime: newEnd };
                        }
                    }
                    return l;
                }));
            } else if (resizingId) {
                let newTime = initialTime.current + deltaTime;
                const block = safeLyrics.find((l: any) => l.id === resizingId);
                if (block && block.startTime !== null) {
                    newTime = Math.max(block.startTime + 0.1, Math.min(newTime, safeDuration));
                    engine.updateLyricBlock(resizingId, { endTime: newTime });
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
    }, [draggingId, resizingId, safeDuration, engine, safeLyrics, selectedIds]);

    if (mappedLyrics.length === 0 && safeLyrics.length === 0) return null;

    return (
        <div 
            ref={containerRef}
            className="border-b border-gray-700 relative flex flex-col shrink-0 overflow-hidden h-full bg-gray-900 overflow-visible"
            onClick={(e) => e.stopPropagation()} // Prevent triggering timeline seeks
            onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedIds(new Set());
            }}
        >
            <div className="absolute top-1 left-1 z-10 bg-blue-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-blue-300 font-bold pointer-events-none">
                LYRICS
            </div>
            
            <div className="flex flex-col relative w-full h-full">
                {mappedLyrics.map((lyric) => {
                    const leftPct = (lyric.startTime! / safeDuration) * 100;
                    
                    // Determine end time 
                    let blockEndTime = lyric.endTime;
                    if (!blockEndTime) {
                        const nextLyrics = mappedLyrics.filter(l => l.startTime! > lyric.startTime!).sort((a,b) => a.startTime! - b.startTime!);
                        blockEndTime = nextLyrics.length > 0 ? Math.min(nextLyrics[0].startTime!, lyric.startTime! + 5) : Math.min(safeDuration, lyric.startTime! + 5);
                    }
                    const widthPct = ((blockEndTime - lyric.startTime!) / safeDuration) * 100;
                    
                    const isSelected = selectedIds.has(lyric.id);
                    const isDragging = draggingId === lyric.id || (draggingId && isSelected);
                    const isResizing = resizingId === lyric.id;
                    
                    return (
                        <div 
                            key={lyric.id}
                            className={`absolute top-1 bottom-1 flex items-center px-1 sm:px-2 py-0.5 rounded border text-[9px] sm:text-[10px] whitespace-nowrap overflow-hidden z-20 transition-colors
                                ${isDragging || isResizing || isSelected
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50 z-30' 
                                    : 'bg-blue-900/50 border-blue-700/50 hover:bg-blue-800/80 hover:border-blue-500 text-blue-200 hover:z-30'
                                }`}
                            style={{ 
                                left: `${leftPct}%`, 
                                width: `${widthPct}%`,
                                minWidth: '20px'
                            }}
                            title={lyric.text}
                        >
                            {/* Drag Handle (Left/Body) */}
                            <div 
                                className="absolute inset-y-0 left-0 right-2 cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    let newSelected = new Set(selectedIds);
                                    if (e.ctrlKey || e.metaKey) {
                                        if (newSelected.has(lyric.id)) {
                                            newSelected.delete(lyric.id);
                                        } else {
                                            newSelected.add(lyric.id);
                                        }
                                    } else {
                                        if (!newSelected.has(lyric.id)) {
                                            newSelected = new Set([lyric.id]);
                                        }
                                    }
                                    setSelectedIds(newSelected);
                                    
                                    if (newSelected.has(lyric.id)) {
                                        setDraggingId(lyric.id);
                                        dragStartX.current = e.clientX;
                                        
                                        const newInitialTimes = new Map();
                                        safeLyrics.forEach((l: any) => {
                                            if (newSelected.has(l.id)) {
                                                newInitialTimes.set(l.id, { start: l.startTime, end: l.endTime });
                                            }
                                        });
                                        initialTimes.current = newInitialTimes;
                                    } else {
                                        setDraggingId(null);
                                    }
                                }}
                            />
                            
                            {/* Resize Handle (Right edge) */}
                            <div 
                                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/20 transition-colors z-40"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizingId(lyric.id);
                                    dragStartX.current = e.clientX;
                                    initialTime.current = blockEndTime!;
                                }}
                            />

                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 opacity-50 pointer-events-none rounded-l"></div>
                            <span className="truncate pl-1 leading-tight font-medium drop-shadow-md pointer-events-none">
                                {lyric.text.split('\n')[0]} 
                                {lyric.text.includes('\n') && <span className="opacity-50 ml-1">...</span>}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
