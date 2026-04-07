'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { loadFont } from '@/utils/fonts';
import { LyricsRenderer, LyricsSettings } from '@/components/LyricsRenderer';


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
                    if (event.data.src) { video.src = event.data.src; video.load(); }
                    else { video.removeAttribute('src'); video.load(); }
                }
                const drift = Math.abs(video.currentTime - event.data.currentTime);
                if (drift > 0.5) video.currentTime = event.data.currentTime;
                if (event.data.playing && video.paused) video.play().catch(() => {});
                else if (!event.data.playing && !video.paused) video.pause();
                if (event.data.currentLyric !== undefined) setCurrentLyric(event.data.currentLyric);
                if (event.data.lyricsSettings !== undefined) setLyricsSettings(event.data.lyricsSettings);
                if (event.data.invertBackground !== undefined) setInvertBackground(event.data.invertBackground);
                if (event.data.showLyrics !== undefined) setShowLyrics(event.data.showLyrics);
                if (event.data.videoOpacity !== undefined) video.style.opacity = event.data.videoOpacity.toString();
            }
        };

        return () => {
            if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
            channel.close();
        };
    }, []);

    // Load font when settings change
    useEffect(() => {
        if (lyricsSettings?.fontFamily) {
            loadFont(lyricsSettings.fontFamily);
        }
    }, [lyricsSettings?.fontFamily]);

    // Handle lyrics transitions
    useEffect(() => {
        if (currentLyric !== displayedLyric) {
            if (!displayedLyric) {
                setDisplayedLyric(currentLyric);
                setIsExiting(false);
            } else {
                const isKinetic = lyricsSettings?.kineticMode && lyricsSettings.kineticMode !== 'none';
                const kineticExit = lyricsSettings?.kineticExitAnimation;
                const hasKineticExit = isKinetic && kineticExit && kineticExit !== 'none';
                const hasClassicExit = lyricsSettings?.exitAnimation && lyricsSettings.exitAnimation !== 'none';

                if (hasKineticExit || hasClassicExit) {
                    setIsExiting(true);
                    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);

                    let exitDur = 550; // classic exit default
                    if (hasKineticExit && displayedLyric) {
                        const stagger = lyricsSettings?.kineticStagger ?? 40;
                        const unitCount = lyricsSettings?.kineticMode === 'by-letter'
                            ? displayedLyric.replace(/\s/g, '').length
                            : displayedLyric.trim().split(/\s+/).filter(Boolean).length;
                        exitDur = Math.min(900, unitCount * stagger * 0.5 + 350);
                    }

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

    // Pre-compute total non-space units in current block (for reverse exit stagger)
    const totalUnitsInBlock = (() => {
        if (!displayedLyric || !isKinetic) return 0;
        if (lyricsSettings?.kineticMode === 'by-letter') {
            return displayedLyric.replace(/\s/g, '').length;
        }
        return displayedLyric.trim().split(/\s+/).filter(Boolean).length;
    })();

    return (
        <div
            className={`w-screen h-screen flex items-center justify-center overflow-hidden cursor-none transition-colors duration-500 ${invertBackground ? 'bg-white' : 'bg-black'}`}
            onDoubleClick={() => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }}
        >
            <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />

            {/* Lyrics Overlay */}
            {showLyrics && displayedLyric && lyricsSettings && (
                <div className={`absolute inset-x-0 flex flex-col z-50 pointer-events-none px-4 md:px-12
                    ${lyricsSettings.position === 'top' ? 'top-[10vh] justify-start' :
                      lyricsSettings.position === 'middle' ? 'inset-y-0 justify-center' :
                      'bottom-[10vh] justify-end'}`}
                >
                    <LyricsRenderer 
                        text={displayedLyric}
                        settings={lyricsSettings}
                        invertBackground={invertBackground}
                        isExiting={isExiting}
                    />
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
