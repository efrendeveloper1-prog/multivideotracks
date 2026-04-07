import React, { useState } from 'react';
import { useAudioEngine, LyricBlock } from '@/hooks/useAudioEngine';

interface LyricsEditorProps {
    onClose: () => void;
}

export const LyricsEditor: React.FC<LyricsEditorProps> = ({ onClose }) => {
    const { 
        lyrics, setLyrics, currentTime, updateLyricBlock, removeLyricBlock, 
        addLyricBlock, clearLyrics, lyricsSettings, setLyricsSettings 
    } = useAudioEngine();
    const [rawText, setRawText] = useState('');
    const [isPasting, setIsPasting] = useState(lyrics.length === 0);
    const [linesPerBlock, setLinesPerBlock] = useState<1 | 2>(2);

    const handlePasteSubmit = () => {
        if (!rawText.trim()) return;
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const newBlocks: LyricBlock[] = [];
        for (let i = 0; i < lines.length; i += linesPerBlock) {
            const line1 = lines[i];
            const line2 = (linesPerBlock === 2 && lines[i + 1]) ? '\n' + lines[i + 1] : '';
            newBlocks.push({
                id: crypto.randomUUID(),
                text: line1 + line2,
                startTime: null
            });
        }
        
        setLyrics(prev => [...prev, ...newBlocks]);
        setRawText('');
        setIsPasting(false);
    };

    const formatTime = (t: number | null) => {
        if (t === null) return '--:--';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 10);
        return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-800 bg-gray-950">
                    <h2 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
                        <span>📝</span> Editor de Letras (Lyrics)
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs">
                        Cerrar
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-900">
                    {isPasting ? (
                        <div className="flex flex-col gap-3 h-full">
                            <div className="flex justify-between items-center">
                                <label className="text-gray-300 text-xs font-bold">Pega aquí la letra completa de la canción:</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs">Agrupar en:</span>
                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-2 py-1 outline-none font-medium"
                                        value={linesPerBlock}
                                        onChange={(e) => setLinesPerBlock(Number(e.target.value) as 1 | 2)}
                                    >
                                        <option value={1}>1 renglón</option>
                                        <option value={2}>2 renglones</option>
                                    </select>
                                </div>
                            </div>
                            <textarea
                                className="flex-1 bg-gray-950 border border-gray-800 rounded p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[200px] font-sans"
                                placeholder={`Pega el texto aquí... El sistema separará automáticamente la letra en bloques de ${linesPerBlock} rengl${linesPerBlock === 1 ? 'ón' : 'ones'}.`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 shrink-0">
                                {lyrics.length > 0 && (
                                    <button 
                                        onClick={() => setIsPasting(false)} 
                                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button 
                                    onClick={handlePasteSubmit}
                                    disabled={!rawText.trim()}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-xs font-bold transition-colors"
                                >
                                    Auto-Formatear a Bloques
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 relative">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center sticky top-0 bg-gray-900 pb-2 z-10 border-b border-gray-800 mb-2 gap-2">
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span className="text-gray-400 text-xs mr-1 sm:mr-2">{lyrics.length} blq.</span>
                                    
                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                        value={lyricsSettings.position}
                                        onChange={e => setLyricsSettings({...lyricsSettings, position: e.target.value as any})}
                                        title="Posición de Letra"
                                    >
                                        <option value="top">Arriba</option>
                                        <option value="middle">Centro</option>
                                        <option value="bottom">Abajo</option>
                                    </select>
                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                        value={lyricsSettings.align}
                                        onChange={e => setLyricsSettings({...lyricsSettings, align: e.target.value as any})}
                                        title="Alineación"
                                    >
                                        <option value="left">Izq.</option>
                                        <option value="center">Centrado</option>
                                        <option value="right">Der.</option>
                                    </select>
                                    <div className="flex items-center gap-1 bg-gray-800 rounded border border-gray-700 px-1 py-0.5 sm:py-1" title="Tamaño (pt)">
                                        <span className="text-[10px] text-gray-400 hidden sm:inline">Aa</span>
                                        <input 
                                            type="number" 
                                            className="bg-transparent text-gray-200 text-[10px] sm:text-xs outline-none w-8 sm:w-10 text-center font-mono"
                                            value={lyricsSettings.fontSize}
                                            onChange={e => setLyricsSettings({...lyricsSettings, fontSize: Number(e.target.value) || 60})}
                                        />
                                    </div>
                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                        value={lyricsSettings.fontFamily}
                                        onChange={e => setLyricsSettings({...lyricsSettings, fontFamily: e.target.value})}
                                        title="Fuente"
                                    >
                                        <option value="Montserrat, sans-serif">Montserrat</option>
                                        <option value="'Montserrat', sans-serif">Montserrat Bold</option>
                                        <option value="Bebas Neue, sans-serif">Bebas Neue</option>
                                        <option value="Gotham, Montserrat, sans-serif">Gotham</option>
                                        <option value="Poppins, sans-serif">Poppins</option>
                                        <option value="'League Spartan', sans-serif">League Spartan</option>
                                        <option value="Inter, sans-serif">Inter</option>
                                        <option value="system-ui, sans-serif">System UI</option>
                                    </select>

                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                        value={lyricsSettings.animation}
                                        onChange={e => setLyricsSettings({...lyricsSettings, animation: e.target.value as any})}
                                        title="Animación de Entrada"
                                    >
                                        <option value="none">Sin Entrada</option>
                                        <option value="blur-in">Blur Moderno</option>
                                        <option value="slide-up">Deslizamiento</option>
                                        <option value="zoom-in">Zoom In</option>
                                    </select>

                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                        value={lyricsSettings.idleAnimation || 'float-pulse-shine'}
                                        onChange={e => setLyricsSettings({...lyricsSettings, idleAnimation: e.target.value as any})}
                                        title="Animación Durante (Loop)"
                                    >
                                        <option value="none">Sin Anim. Durante</option>
                                        <option value="float-pulse-shine">Flotante + Brillo</option>
                                        <option value="zoom-in-slow">Zoom Suave (In)</option>
                                        <option value="zoom-out-slow">Zoom Suave (Out)</option>
                                    </select>

                                    <select 
                                        className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                        value={lyricsSettings.exitAnimation || 'slide-down-stagger'}
                                        onChange={e => setLyricsSettings({...lyricsSettings, exitAnimation: e.target.value as any})}
                                        title="Animación de Salida"
                                    >
                                        <option value="none">Sin Salida</option>
                                        <option value="slide-down-stagger">Desplazar Abajo</option>
                                    </select>

                                    {/* ─── Kinetic Typography ─── */}
                                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-600">
                                        <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider hidden sm:inline">KT</span>
                                        <select
                                            className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                            value={lyricsSettings.kineticMode || 'none'}
                                            onChange={e => setLyricsSettings({...lyricsSettings, kineticMode: e.target.value as any})}
                                            title="Kinetic Typography: modo de animación"
                                        >
                                            <option value="none">Sin Kinetic</option>
                                            <option value="by-word">Por Palabra</option>
                                            <option value="by-letter">Por Letra</option>
                                        </select>

                                        {(lyricsSettings.kineticMode && lyricsSettings.kineticMode !== 'none') && (<>
                                            <select
                                                className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                                value={lyricsSettings.kineticAnimation || 'wave'}
                                                onChange={e => setLyricsSettings({...lyricsSettings, kineticAnimation: e.target.value as any})}
                                                title="Kinetic: efecto de animación entrada"
                                            >
                                                <option value="wave">🌊 Wave</option>
                                                <option value="fall-in">⬇ Fall In</option>
                                                <option value="bounce">🏀 Bounce</option>
                                                <option value="flip">🔄 Flip 3D</option>
                                                <option value="glitch-reveal">⚡ Glitch</option>
                                                <option value="slide-cascade">➡ Cascade</option>
                                            </select>
                                            <div className="flex items-center gap-0.5 bg-purple-900/30 rounded border border-purple-700/50 px-1 py-0.5" title="Stagger (ms entre letras/palabras)">
                                                <span className="text-[9px] text-purple-400 hidden sm:inline">⏱</span>
                                                <input
                                                    type="number"
                                                    min={10} max={300} step={5}
                                                    className="bg-transparent text-purple-200 text-[10px] sm:text-xs outline-none w-8 text-center font-mono"
                                                    value={lyricsSettings.kineticStagger ?? 40}
                                                    onChange={e => setLyricsSettings({...lyricsSettings, kineticStagger: Math.max(10, Math.min(300, Number(e.target.value) || 40))})}
                                                    title="Delay entre letras/palabras en ms"
                                                />
                                                <span className="text-[8px] text-purple-500 hidden sm:inline">ms</span>
                                            </div>
                                            <select
                                                className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                                value={lyricsSettings.kineticExitAnimation || 'wave-out'}
                                                onChange={e => setLyricsSettings({...lyricsSettings, kineticExitAnimation: e.target.value as any})}
                                                title="Kinetic: efecto de salida"
                                            >
                                                <option value="none">↩ Sin Salida</option>
                                                <option value="fade-out">↩ Fade Out</option>
                                                <option value="wave-out">↩ Wave Out</option>
                                                <option value="scatter">↩ Scatter</option>
                                                <option value="collapse">↩ Collapse</option>
                                                <option value="blur-out">↩ Blur Out</option>
                                            </select>
                                        </>)}

                                    </div>

                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsPasting(true)}
                                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded text-[10px] sm:text-xs font-bold transition-colors"
                                    >
                                        + Agregar Texto
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('¿Estás seguro de que quieres borrar TODA la letra?')) clearLyrics();
                                        }}
                                        className="px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-900/50 rounded text-[10px] sm:text-xs font-bold transition-colors"
                                    >
                                        Vaciar
                                    </button>
                                </div>
                            </div>
                            
                            {lyrics.map((block, idx) => (
                                <div key={block.id} className="flex gap-2 items-start bg-gray-800/50 p-2 sm:p-3 rounded border border-gray-700/50 group">
                                    <div className="flex flex-col items-center justify-center gap-1 shrink-0 w-12 sm:w-16">
                                        <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">#{idx+1}</span>
                                        <div className="text-[10px] sm:text-xs font-mono font-bold text-green-400 bg-gray-950 px-1 py-0.5 rounded w-full text-center">
                                            {formatTime(block.startTime)}
                                        </div>
                                    </div>
                                    
                                    <textarea 
                                        className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs sm:text-sm text-gray-200 min-h-[2.5rem] resize-y focus:outline-none focus:border-blue-500"
                                        value={block.text}
                                        onChange={(e) => updateLyricBlock(block.id, { text: e.target.value })}
                                    />
                                    
                                    <div className="flex flex-col gap-1 shrink-0 justify-start">
                                        <button 
                                            onClick={() => updateLyricBlock(block.id, { startTime: currentTime })}
                                            title="Mapear al Playhead actual"
                                            className="p-1 sm:px-2 sm:py-1 bg-blue-900/40 hover:bg-blue-800 text-blue-400 hover:text-white border border-blue-800/50 rounded text-[10px] sm:text-xs font-bold transition-colors"
                                        >
                                            <span className="hidden sm:inline">↓ Mapear</span>
                                            <span className="sm:hidden">↓</span>
                                        </button>
                                        <button 
                                            onClick={() => removeLyricBlock(block.id)}
                                            className="p-1 sm:px-2 sm:py-1 bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-400 rounded text-[10px] sm:text-xs transition-colors"
                                        >
                                            <span className="hidden sm:inline">Borrar</span>
                                            <span className="sm:hidden">×</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {lyrics.length === 0 && !isPasting && (
                                <div className="text-center p-8 text-gray-500 text-sm">
                                    No hay bloques de letra.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
