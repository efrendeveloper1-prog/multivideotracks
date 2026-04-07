import React from 'react';

export interface LyricsSettings {
    align: 'left' | 'center' | 'right';
    position: 'top' | 'middle' | 'bottom';
    fontSize: number;
    fontFamily: string;
    animation: 'none' | 'blur-in' | 'slide-up' | 'zoom-in';
    idleAnimation?: 'none' | 'float-pulse-shine' | 'zoom-in-slow' | 'zoom-out-slow';
    exitAnimation?: 'none' | 'slide-down-stagger';
    kineticMode?: 'none' | 'by-letter' | 'by-word';
    kineticAnimation?: 'wave' | 'fall-in' | 'bounce' | 'flip' | 'glitch-reveal' | 'slide-cascade';
    kineticStagger?: number;
    kineticExitAnimation?: 'none' | 'fade-out' | 'wave-out' | 'scatter' | 'collapse' | 'blur-out';
}

interface LyricsRendererProps {
    text: string;
    settings: LyricsSettings;
    invertBackground: boolean;
    isExiting: boolean;
    scale?: number;
}

// ─── Kinetic exit animation class mapper ──────────────────────────────────────
function getKineticExitClass(exitAnim: string | undefined): string {
    switch (exitAnim) {
        case 'fade-out':   return 'animate-kt-exit-fade';
        case 'wave-out':   return 'animate-kt-exit-wave';
        case 'scatter':    return 'animate-kt-exit-scatter';
        case 'collapse':   return 'animate-kt-exit-collapse';
        case 'blur-out':   return 'animate-kt-exit-blur';
        case 'none':       return '';
        default:           return 'animate-kt-exit-wave';
    }
}

// ─── Kinetic Typography Unit renderer ────────────────────────────────────────
interface KineticUnitProps {
    unit: string;
    index: number;
    isSpace?: boolean;
    enterClass: string;
    exitClass: string;
    staggerMs: number;
    baseStyle: React.CSSProperties;
    isExiting: boolean;
    exitDelayMs: number;
    scatterStyle?: React.CSSProperties;
}

function KineticUnit({
    unit, index, isSpace, enterClass, exitClass,
    staggerMs, baseStyle, isExiting, exitDelayMs, scatterStyle
}: KineticUnitProps) {
    if (isSpace) return <span style={{ display: 'inline-block', width: '0.3em' }} />;

    const animClass = isExiting ? exitClass : enterClass;
    const delay = isExiting ? exitDelayMs : index * staggerMs;

    return (
        <span
            className={animClass}
            style={{
                ...baseStyle,
                ...(isExiting && scatterStyle ? scatterStyle : {}),
                display: 'inline-block',
                animationDelay: `${delay}ms`,
                opacity: isExiting ? undefined : 0,
            }}
        >
            {unit}
        </span>
    );
}

// ─── Kinetic Line renderer ────────────────────────────────────────────────────
interface KineticLineProps {
    line: string;
    lineIndex: number;
    settings: LyricsSettings;
    invertBackground: boolean;
    isExiting: boolean;
    globalUnitOffset: number;
    totalUnitsInBlock: number;
    scale: number;
}

function KineticLine({
    line, lineIndex, settings, invertBackground, isExiting, globalUnitOffset, totalUnitsInBlock, scale
}: KineticLineProps) {
    const mode = settings.kineticMode || 'none';
    const enterClass = `animate-kt-${settings.kineticAnimation || 'wave'}`;
    const exitClass = getKineticExitClass(settings.kineticExitAnimation);
    const stagger = settings.kineticStagger ?? 40;

    const baseStyle: React.CSSProperties = {
        fontFamily: settings.fontFamily,
        fontSize: `${Math.max(12, settings.fontSize * scale)}px`,
        fontWeight: 'bold',
        lineHeight: '1.2',
        color: invertBackground ? '#000' : '#fff',
        textShadow: invertBackground ? 'none' : `0px ${4 * scale}px ${20 * scale}px rgba(0,0,0,0.8), 0px ${2 * scale}px ${8 * scale}px rgba(0,0,0,1)`,
    };

    if (mode === 'none') {
        // Legacy rendering
        return (
            <p
                className={`font-bold tracking-tight block transition-all
                    ${invertBackground ? 'text-black' : 'text-white'}
                    ${!isExiting && settings.idleAnimation === 'float-pulse-shine' ? 'animate-idle-float-pulse animate-shine-glitch' : ''}
                    ${!isExiting && settings.idleAnimation === 'zoom-in-slow' ? 'animate-zoom-in-slow' : ''}
                    ${!isExiting && settings.idleAnimation === 'zoom-out-slow' ? 'animate-zoom-out-slow' : ''}
                    ${isExiting ? 'animate-exit-down' : ''}
                `}
                style={{
                    textShadow: invertBackground ? 'none' : `0px ${4 * scale}px ${20 * scale}px rgba(0,0,0,0.8), 0px ${2 * scale}px ${8 * scale}px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)`,
                    lineHeight: '1.2',
                    fontFamily: settings.fontFamily,
                    fontSize: `${Math.max(12, settings.fontSize * scale)}px`,
                    backgroundImage: (!invertBackground && settings.idleAnimation === 'float-pulse-shine') ? 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)' : 'none',
                    backgroundSize: '200% auto',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    display: 'inline-block',
                    width: '100%',
                    animationDelay: isExiting ? `${lineIndex * 100}ms` : '0ms'
                }}
            >
                {line}
            </p>
        );
    }

    // Build units array
    const units: { text: string; isSpace: boolean }[] = [];
    if (mode === 'by-letter') {
        for (const char of line) {
            units.push({ text: char === ' ' ? ' ' : char, isSpace: char === ' ' });
        }
    } else {
        const words = line.split(' ');
        words.forEach((w, wi) => {
            units.push({ text: w, isSpace: false });
            if (wi < words.length - 1) units.push({ text: ' ', isSpace: true });
        });
    }

    const nonSpaceUnits = units.filter(u => !u.isSpace);

    // Pre-compute scatter offsets deterministically (seeded by position)
    const scatterOffsets = nonSpaceUnits.map((_, ni) => {
        const seed = (globalUnitOffset + ni) * 137.508; // golden angle spread
        const angle = seed % 360;
        const dist = (30 + (seed % 40)) * scale;
        const sx = Math.round(Math.cos(angle * Math.PI / 180) * dist);
        const sy = Math.round(Math.sin(angle * Math.PI / 180) * dist - (20 * scale));
        return { '--kt-sx': `${sx}px`, '--kt-sy': `${sy}px` } as React.CSSProperties;
    });

    return (
        <div style={{ lineHeight: '1.3', marginBottom: '0.15em' }}>
            {units.map((unit, ui) => {
                const nonSpaceLocalIdx = units.slice(0, ui).filter(u => !u.isSpace).length;
                const globalIdx = globalUnitOffset + nonSpaceLocalIdx;

                // Exit delay: reverse stagger from last unit to first (dramatic wave-out)
                const reverseIdx = totalUnitsInBlock - 1 - globalIdx;
                const exitDelay = settings.kineticExitAnimation === 'none'
                    ? 0
                    : reverseIdx * (stagger * 0.5);

                const scatterStyle = settings.kineticExitAnimation === 'scatter'
                    ? scatterOffsets[nonSpaceLocalIdx]
                    : undefined;

                return (
                    <KineticUnit
                        key={ui}
                        unit={unit.text}
                        index={globalIdx}
                        isSpace={unit.isSpace}
                        enterClass={enterClass}
                        exitClass={exitClass}
                        staggerMs={stagger}
                        baseStyle={baseStyle}
                        isExiting={isExiting}
                        exitDelayMs={exitDelay}
                        scatterStyle={scatterStyle}
                    />
                );
            })}
        </div>
    );
}

export const LyricsRenderer: React.FC<LyricsRendererProps> = ({
    text, settings, invertBackground, isExiting, scale = 1
}) => {
    const isKinetic = settings.kineticMode && settings.kineticMode !== 'none';

    // Pre-compute total non-space units in current block (for reverse exit stagger)
    const totalUnitsInBlock = (() => {
        if (!text || !isKinetic) return 0;
        if (settings?.kineticMode === 'by-letter') {
            return text.replace(/\s/g, '').length;
        }
        return text.trim().split(/\s+/).filter(Boolean).length;
    })();

    if (isKinetic) {
        return (
            <div
                key={text}
                className={`w-full max-w-6xl mx-auto
                    ${settings.align === 'left' ? 'text-left' :
                      settings.align === 'right' ? 'text-right' : 'text-center'}`}
            >
                {text.split('\n').map((line, lineIdx, allLines) => {
                    let globalOffset = 0;
                    for (let i = 0; i < lineIdx; i++) {
                        const prev = allLines[i];
                        globalOffset += settings.kineticMode === 'by-letter'
                            ? prev.replace(/\s/g, '').length
                            : prev.trim().split(/\s+/).filter(Boolean).length;
                    }
                    return (
                        <KineticLine
                            key={`${text}-${lineIdx}`}
                            line={line}
                            lineIndex={lineIdx}
                            settings={settings}
                            invertBackground={invertBackground}
                            isExiting={isExiting}
                            globalUnitOffset={globalOffset}
                            totalUnitsInBlock={totalUnitsInBlock}
                            scale={scale}
                        />
                    );
                })}
            </div>
        );
    }

    // Classic Mode
    return (
        <div
            key={text}
            className={`w-full max-w-6xl space-y-1 sm:space-y-2 md:space-y-4 mx-auto
            ${settings.align === 'left' ? 'text-left' :
              settings.align === 'right' ? 'text-right' : 'text-center'}
            ${isExiting ? 'animate-exit-down' :
              settings.animation === 'blur-in' ? 'animate-blur-in' :
              settings.animation === 'slide-up' ? 'animate-slide-up' :
              settings.animation === 'zoom-in' ? 'animate-zoom-in' : ''}`}
        >
            {text.split('\n').map((line, i) => (
                <p
                    key={i}
                    className={`font-bold tracking-tight block transition-all
                        ${invertBackground ? 'text-black' : 'text-white'}
                        ${!isExiting && settings.idleAnimation === 'float-pulse-shine' ? 'animate-idle-float-pulse animate-shine-glitch' : ''}
                        ${!isExiting && settings.idleAnimation === 'zoom-in-slow' ? 'animate-zoom-in-slow' : ''}
                        ${!isExiting && settings.idleAnimation === 'zoom-out-slow' ? 'animate-zoom-out-slow' : ''}
                        ${isExiting ? 'animate-exit-down' : ''}
                    `}
                    style={{
                        textShadow: invertBackground ? 'none' : `0px ${4 * scale}px ${20 * scale}px rgba(0,0,0,0.8), 0px ${2 * scale}px ${8 * scale}px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)`,
                        lineHeight: '1.2',
                        fontFamily: settings.fontFamily,
                        fontSize: `${Math.max(12, settings.fontSize * scale)}px`,
                        backgroundImage: (!invertBackground && settings.idleAnimation === 'float-pulse-shine') ? 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)' : 'none',
                        backgroundSize: '200% auto',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        display: 'inline-block',
                        width: '100%',
                        animationDelay: isExiting ? `${i * 100}ms` : '0ms'
                    }}
                >
                    {line}
                </p>
            ))}
        </div>
    );
};
