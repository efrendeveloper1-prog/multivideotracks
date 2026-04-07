'use client';

import { useEffect, useRef, useState, Suspense } from 'react';

interface LyricsSettings {
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
}

// ─── Kinetic Typography Unit renderer ────────────────────────────────────────
interface KineticUnitProps {
    unit: string;
    index: number;
    isSpace?: boolean;
    animClass: string;
    staggerMs: number;
    baseStyle: React.CSSProperties;
    isExiting: boolean;
    exitDelayMs: number;
}

function KineticUnit({ unit, index, isSpace, animClass, staggerMs, baseStyle, isExiting, exitDelayMs }: KineticUnitProps) {
    if (isSpace) return <span style={{ display: 'inline-block', width: '0.3em' }} />;
    return (
        <span
            className={isExiting ? 'animate-exit-down' : animClass}
            style={{
                ...baseStyle,
                display: 'inline-block',
                animationDelay: isExiting
                    ? `${exitDelayMs}ms`
                    : `${index * staggerMs}ms`,
                opacity: isExiting ? 1 : 0,
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
    /** total units in ALL previous lines (for global stagger offset) */
    globalUnitOffset: number;
}

function KineticLine({ line, lineIndex, settings, invertBackground, isExiting, globalUnitOffset }: KineticLineProps) {
    const mode = settings.kineticMode || 'none';
    const animClass = `animate-kt-${settings.kineticAnimation || 'wave'}`;
    const stagger = settings.kineticStagger ?? 40;

    const baseStyle: React.CSSProperties = {
        fontFamily: settings.fontFamily,
        fontSize: `${Math.max(24, settings.fontSize)}px`,
        fontWeight: 'bold',
        lineHeight: '1.2',
        color: invertBackground ? '#000' : '#fff',
        textShadow: invertBackground ? 'none' : '0px 4px 20px rgba(0,0,0,0.8), 0px 2px 8px rgba(0,0,0,1)',
    };

    if (mode === 'none') {
        // Legacy rendering — no kinetic
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
                    textShadow: invertBackground ? 'none' : '0px 4px 20px rgba(0,0,0,0.8), 0px 2px 8px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)',
                    lineHeight: '1.2',
                    fontFamily: settings.fontFamily,
                    fontSize: `${Math.max(24, settings.fontSize)}px`,
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

    // Kinetic mode: split into units
    const units: { text: string; isSpace: boolean }[] = [];
    if (mode === 'by-letter') {
        for (const char of line) {
            if (char === ' ') {
                units.push({ text: ' ', isSpace: true });
            } else {
                units.push({ text: char, isSpace: false });
            }
        }
    } else {
        // by-word
        const words = line.split(' ');
        words.forEach((w, wi) => {
            units.push({ text: w, isSpace: false });
            if (wi < words.length - 1) units.push({ text: ' ', isSpace: true });
        });
    }

    const nonSpaceCount = units.filter(u => !u.isSpace).length;

    return (
        <p style={{ lineHeight: '1.3', marginBottom: '0.15em' }}>
            {units.map((unit, ui) => {
                // global index = offset from previous lines + local non-space index
                const nonSpaceLocalIdx = units.slice(0, ui).filter(u => !u.isSpace).length;
                const globalIdx = globalUnitOffset + nonSpaceLocalIdx;
                // exit delay goes in reverse for dramatic effect
                const exitDelay = (nonSpaceCount - 1 - nonSpaceLocalIdx) * (stagger * 0.6);

                return (
                    <KineticUnit
                        key={ui}
                        unit={unit.text}
                        index={globalIdx}
                        isSpace={unit.isSpace}
                        animClass={animClass}
                        staggerMs={stagger}
                        baseStyle={baseStyle}
                        isExiting={isExiting}
                        exitDelayMs={exitDelay}
                    />
                );
            })}
        </p>
    );
}

// ─── Main presentation component ──────────────────────────────────────────────
function PresentationContent() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const [currentLyric, setCurrentLyric] = useState<string | null>(null);
    const [displayedLyric, setDisplayedLyric] = useState<string | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const [lyricsSettings, setLyricsSettings] = useState<LyricsSettings | null>(null);
    const [invertBackground, setInvertBackground] = useState<boolean>(false);
    const [showLyrics, setShowLyrics] = useState<boolean>(true);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const channel = new BroadcastChannel('second-screen-video');
        channelRef.current = channel;

        channel.postMessage({ type: 'ready' });

        channel.onmessage = (event) => {
            const video = videoRef.current;
            if (!video) return;

            if (event.data.type === 'sync') {
                if (event.data.src !== undefined && video.src !== event.data.src) {
                    if (event.data.src) {
                        video.src = event.data.src;
                        video.load();
                    } else {
                        video.removeAttribute('src');
                        video.load();
                    }
                }
                const drift = Math.abs(video.currentTime - event.data.currentTime);
                if (drift > 0.5) {
                    video.currentTime = event.data.currentTime;
                }
                if (event.data.playing && video.paused) {
                    video.play().catch(() => { });
                } else if (!event.data.playing && !video.paused) {
                    video.pause();
                }
                if (event.data.currentLyric !== undefined) {
                    setCurrentLyric(event.data.currentLyric);
                }
                if (event.data.lyricsSettings !== undefined) {
                    setLyricsSettings(event.data.lyricsSettings);
                }
                if (event.data.invertBackground !== undefined) {
                    setInvertBackground(event.data.invertBackground);
                }
                if (event.data.showLyrics !== undefined) {
                    setShowLyrics(event.data.showLyrics);
                }
                if (event.data.videoOpacity !== undefined) {
                    video.style.opacity = event.data.videoOpacity.toString();
                }
            }
        };

        return () => {
            if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
            channel.close();
        };
    }, []);

    // Handle lyrics transitions
    useEffect(() => {
        if (currentLyric !== displayedLyric) {
            if (!displayedLyric) {
                setDisplayedLyric(currentLyric);
                setIsExiting(false);
            } else {
                const hasExitAnim = lyricsSettings?.exitAnimation && lyricsSettings.exitAnimation !== 'none';
                const isKinetic = lyricsSettings?.kineticMode && lyricsSettings.kineticMode !== 'none';
                if (hasExitAnim || isKinetic) {
                    setIsExiting(true);
                    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
                    // Give kinetic exit animations time based on stagger
                    const stagger = lyricsSettings?.kineticStagger ?? 40;
                    const lineCount = displayedLyric.split('\n').length;
                    const charCount = displayedLyric.replace(/\s/g, '').length;
                    const exitDur = isKinetic
                        ? Math.min(800, charCount * stagger * 0.5 + 300)
                        : 550;
                    exitTimeoutRef.current = setTimeout(() => {
                        setDisplayedLyric(currentLyric);
                        setIsExiting(false);
                    }, exitDur);
                } else {
                    setDisplayedLyric(currentLyric);
                    setIsExiting(false);
                }
            }
        }
    }, [currentLyric, displayedLyric, lyricsSettings]);

    const isKinetic = lyricsSettings?.kineticMode && lyricsSettings.kineticMode !== 'none';

    return (
        <div
            className={`w-screen h-screen flex items-center justify-center overflow-hidden cursor-none transition-colors duration-500 ${invertBackground ? 'bg-white' : 'bg-black'}`}
            onDoubleClick={() => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else {
                    document.exitFullscreen().catch(() => { });
                }
            }}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
            />

            {/* Lyrics Overlay */}
            {showLyrics && displayedLyric && lyricsSettings && (
                <div className={`absolute inset-x-0 flex flex-col z-50 pointer-events-none px-4 md:px-12
                    ${lyricsSettings.position === 'top' ? 'top-[10vh] justify-start' :
                      lyricsSettings.position === 'middle' ? 'inset-y-0 justify-center' :
                      'bottom-[10vh] justify-end'}`}
                >
                    {isKinetic ? (
                        // ── KINETIC MODE: letter/word by letter/word ──────────────
                        <div
                            key={displayedLyric}
                            className={`w-full max-w-6xl mx-auto
                                ${lyricsSettings.align === 'left' ? 'text-left' :
                                  lyricsSettings.align === 'right' ? 'text-right' : 'text-center'}`}
                        >
                            {displayedLyric.split('\n').map((line, lineIdx, allLines) => {
                                // compute global unit offset = sum of non-space units in previous lines
                                let globalOffset = 0;
                                for (let i = 0; i < lineIdx; i++) {
                                    const prev = allLines[i];
                                    if (lyricsSettings.kineticMode === 'by-letter') {
                                        globalOffset += prev.replace(/\s/g, '').length;
                                    } else {
                                        globalOffset += prev.trim().split(/\s+/).filter(Boolean).length;
                                    }
                                }
                                return (
                                    <KineticLine
                                        key={lineIdx}
                                        line={line}
                                        lineIndex={lineIdx}
                                        settings={lyricsSettings}
                                        invertBackground={invertBackground}
                                        isExiting={isExiting}
                                        globalUnitOffset={globalOffset}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        // ── CLASSIC MODE: block animation ─────────────────────────
                        <div
                            key={displayedLyric}
                            className={`w-full max-w-6xl space-y-1 sm:space-y-2 md:space-y-4 mx-auto
                            ${lyricsSettings.align === 'left' ? 'text-left' :
                              lyricsSettings.align === 'right' ? 'text-right' : 'text-center'}
                            ${isExiting ? 'animate-exit-down' :
                              lyricsSettings.animation === 'blur-in' ? 'animate-blur-in' :
                              lyricsSettings.animation === 'slide-up' ? 'animate-slide-up' :
                              lyricsSettings.animation === 'zoom-in' ? 'animate-zoom-in' : ''}`}
                        >
                            {displayedLyric.split('\n').map((line, i) => (
                                <p
                                    key={i}
                                    className={`font-bold tracking-tight block transition-all
                                        ${invertBackground ? 'text-black' : 'text-white'}
                                        ${!isExiting && lyricsSettings.idleAnimation === 'float-pulse-shine' ? 'animate-idle-float-pulse animate-shine-glitch' : ''}
                                        ${!isExiting && lyricsSettings.idleAnimation === 'zoom-in-slow' ? 'animate-zoom-in-slow' : ''}
                                        ${!isExiting && lyricsSettings.idleAnimation === 'zoom-out-slow' ? 'animate-zoom-out-slow' : ''}
                                        ${isExiting ? 'animate-exit-down' : ''}
                                    `}
                                    style={{
                                        textShadow: invertBackground ? 'none' : '0px 4px 20px rgba(0,0,0,0.8), 0px 2px 8px rgba(0,0,0,1), 0px 0px 2px rgba(0,0,0,1)',
                                        lineHeight: '1.2',
                                        fontFamily: lyricsSettings.fontFamily,
                                        fontSize: `${Math.max(24, lyricsSettings.fontSize)}px`,
                                        backgroundImage: (!invertBackground && lyricsSettings.idleAnimation === 'float-pulse-shine') ? 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)' : 'none',
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
                    )}
                </div>
            )}
        </div>
    );
}

export default function PresentationPage() {
    return (
        <Suspense fallback={
            <div className="w-screen h-screen bg-black flex items-center justify-center text-white">
                Cargando...
            </div>
        }>
            <PresentationContent />
        </Suspense>
    );
}
