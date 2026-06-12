import React, { useMemo } from 'react';
import { GuitarChordShape, PianoChordShape, GUITAR_CHORDS, PIANO_CHORDS } from '@/utils/chordShapes';

interface ChordDiagramProps {
    chordName: string;
    instrument: 'guitar' | 'piano';
    isActive?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// ── Guitar Diagram ──────────────────────────────────────────────────────────

const STRING_COUNT = 6;
const FRET_COUNT = 5;

const GuitarDiagram: React.FC<{ shape: GuitarChordShape; isActive: boolean; size: 'sm' | 'md' | 'lg' }> = ({ shape, isActive, size }) => {
    const w = size === 'sm' ? 72 : size === 'lg' ? 120 : 90;
    const h = size === 'sm' ? 82 : size === 'lg' ? 140 : 105;
    const padTop = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
    const padLeft = size === 'sm' ? 14 : size === 'lg' ? 22 : 17;
    const padRight = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;
    const padBottom = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;

    const gridW = w - padLeft - padRight;
    const gridH = h - padTop - padBottom;
    const stringSpacing = gridW / (STRING_COUNT - 1);
    const fretSpacing = gridH / FRET_COUNT;
    const dotR = size === 'sm' ? 5 : size === 'lg' ? 9 : 7;
    const fontSize = size === 'sm' ? 8 : size === 'lg' ? 13 : 10;

    const activeColor = '#10b981';
    const dimColor = '#6b7280';
    const nutColor = isActive ? activeColor : dimColor;

    // Find the relative screen fret (1..FRET_COUNT) for each absolute fret
    const toScreen = (absF: number | null) => {
        if (absF === null) return null;
        if (absF === 0) return 0;
        return absF - shape.baseFret + 1;
    };

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {/* Nut or baseFret indicator */}
            {shape.baseFret === 1 ? (
                <rect x={padLeft} y={padTop - 2} width={gridW} height={3} rx={1}
                    fill={nutColor} opacity={0.9} />
            ) : (
                <text x={padLeft - 4} y={padTop + fretSpacing * 0.6}
                    fontSize={fontSize - 1} fill={isActive ? '#a7f3d0' : '#9ca3af'}
                    textAnchor="end" fontFamily="monospace" fontWeight="bold">
                    {shape.baseFret}
                </text>
            )}

            {/* Fret lines */}
            {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
                <line key={`fl${i}`}
                    x1={padLeft} y1={padTop + i * fretSpacing}
                    x2={padLeft + gridW} y2={padTop + i * fretSpacing}
                    stroke={i === 0 ? nutColor : '#374151'} strokeWidth={i === 0 ? 2 : 1} />
            ))}

            {/* String lines */}
            {Array.from({ length: STRING_COUNT }, (_, s) => (
                <line key={`sl${s}`}
                    x1={padLeft + s * stringSpacing} y1={padTop}
                    x2={padLeft + s * stringSpacing} y2={padTop + FRET_COUNT * fretSpacing}
                    stroke={isActive ? '#1f2937' : '#374151'} strokeWidth={1} />
            ))}

            {/* Barre indicators */}
            {shape.barres?.map((b, bi) => {
                const screenFret = b.fret - shape.baseFret + 1;
                if (screenFret < 1 || screenFret > FRET_COUNT) return null;
                const y = padTop + (screenFret - 0.5) * fretSpacing;
                const x1 = padLeft + b.fromString * stringSpacing;
                const x2 = padLeft + b.toString * stringSpacing;
                return (
                    <rect key={`br${bi}`}
                        x={x1} y={y - dotR * 0.9} width={x2 - x1} height={dotR * 1.8}
                        rx={dotR} fill={isActive ? '#10b981' : '#4b5563'} opacity={0.9} />
                );
            })}

            {/* Finger dots */}
            {shape.strings.map((s, si) => {
                const screenFret = toScreen(s.fret);
                if (screenFret === null) {
                    // Muted
                    return (
                        <text key={`mx${si}`}
                            x={padLeft + si * stringSpacing}
                            y={padTop - 6}
                            fontSize={fontSize} fill={dimColor}
                            textAnchor="middle" fontWeight="bold">✕</text>
                    );
                }
                if (screenFret === 0) {
                    // Open
                    return (
                        <circle key={`op${si}`}
                            cx={padLeft + si * stringSpacing} cy={padTop - 6}
                            r={dotR * 0.55}
                            fill="none" stroke={isActive ? activeColor : dimColor} strokeWidth={1.5} />
                    );
                }
                if (screenFret < 1 || screenFret > FRET_COUNT) return null;
                const cx = padLeft + si * stringSpacing;
                const cy = padTop + (screenFret - 0.5) * fretSpacing;
                return (
                    <circle key={`dot${si}`} cx={cx} cy={cy} r={dotR}
                        fill={isActive ? activeColor : '#4b5563'} />
                );
            })}
        </svg>
    );
};

// ── Piano Diagram ──────────────────────────────────────────────────────────

const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_NOTES = [1, 3, null, 6, 8, 10, null]; // C# D# (gap) F# G# A# (gap)
const BLACK_POSITIONS = [0, 1, null, 3, 4, 5, null]; // position among whites (gap at E-F, B-C)

const PianoDiagram: React.FC<{ shape: PianoChordShape; isActive: boolean; size: 'sm' | 'md' | 'lg' }> = ({ shape, isActive, size }) => {
    const ww = size === 'sm' ? 11 : size === 'lg' ? 18 : 13; // white key width
    const wh = size === 'sm' ? 50 : size === 'lg' ? 80 : 60;  // white key height
    const bw = ww * 0.65;
    const bh = wh * 0.62;
    const totalW = ww * 7;
    const totalH = wh + 2;

    const activeKeys = new Set(shape.keys);
    const activeColor = isActive ? '#10b981' : '#6b7280';
    const labelSize = size === 'sm' ? 7 : size === 'lg' ? 11 : 9;

    return (
        <svg width={totalW} height={totalH + 2} viewBox={`0 0 ${totalW} ${totalH + 2}`}>
            {/* White keys */}
            {WHITE_NOTES.map((note, i) => {
                const isHighlighted = activeKeys.has(note);
                return (
                    <rect key={`w${i}`}
                        x={i * ww + 0.5} y={0.5}
                        width={ww - 1} height={wh}
                        rx={1.5}
                        fill={isHighlighted ? activeColor : '#f9fafb'}
                        stroke="#374151" strokeWidth={0.75}
                        opacity={isHighlighted ? 1 : 0.9}
                    />
                );
            })}
            {/* Black keys */}
            {BLACK_NOTES.map((note, i) => {
                if (note === null) return null;
                const pos = BLACK_POSITIONS[i];
                if (pos === null) return null;
                const x = (pos + 1) * ww - bw / 2;
                const isHighlighted = activeKeys.has(note);
                return (
                    <rect key={`b${i}`}
                        x={x} y={0.5}
                        width={bw} height={bh}
                        rx={1}
                        fill={isHighlighted ? activeColor : '#111827'}
                        stroke={isHighlighted ? '#059669' : '#1f2937'} strokeWidth={0.5}
                    />
                );
            })}

            {/* Chord label below */}
            <text x={totalW / 2} y={totalH + 1}
                fontSize={labelSize} fill={isActive ? '#a7f3d0' : '#9ca3af'}
                textAnchor="middle" fontWeight="bold" fontFamily="monospace">
            </text>
        </svg>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
    chordName,
    instrument,
    isActive = false,
    size = 'md'
}) => {
    const titleSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-base' : 'text-xs';
    const containerCls = `flex flex-col items-center gap-1 transition-all duration-300 ${
        isActive
            ? 'opacity-100 scale-110 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]'
            : 'opacity-55 scale-95'
    }`;

    const guitarShape = useMemo(() => GUITAR_CHORDS[chordName], [chordName]);
    const pianoShape = useMemo(() => PIANO_CHORDS[chordName], [chordName]);

    const label = (
        <span className={`${titleSize} font-bold font-mono tracking-wide ${
            isActive ? 'text-emerald-400' : 'text-gray-400'
        }`}>
            {chordName}
        </span>
    );

    if (instrument === 'guitar') {
        if (!guitarShape) {
            return (
                <div className={containerCls}>
                    {label}
                    <div className={`${
                        size === 'sm' ? 'w-16 h-20' : size === 'lg' ? 'w-28 h-36' : 'w-20 h-24'
                    } flex items-center justify-center border border-dashed ${
                        isActive ? 'border-emerald-700' : 'border-gray-700'
                    } rounded text-[8px] text-gray-600`}>
                        ?
                    </div>
                </div>
            );
        }
        return (
            <div className={containerCls}>
                {label}
                <GuitarDiagram shape={guitarShape} isActive={isActive} size={size} />
            </div>
        );
    }

    // Piano
    if (!pianoShape) {
        return (
            <div className={containerCls}>
                {label}
                <div className={`flex items-center justify-center border border-dashed ${
                    isActive ? 'border-emerald-700' : 'border-gray-700'
                } rounded text-[8px] text-gray-600 w-24 h-16`}>
                    ?
                </div>
            </div>
        );
    }

    return (
        <div className={containerCls}>
            {label}
            <PianoDiagram shape={pianoShape} isActive={isActive} size={size} />
        </div>
    );
};
