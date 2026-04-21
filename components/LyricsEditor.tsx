import React, { useState, useMemo } from 'react';
import { useAudioEngine, LyricBlock } from '@/hooks/useAudioEngine';
import { FontPicker } from './FontPicker';
import { processVocalTrackForAI } from '@/utils/audioApiSync';

interface LyricsEditorProps {
    onClose: () => void;
}

type EditorView = 'choose' | 'choose-track' | 'manual-paste' | 'editor';

export const LyricsEditor: React.FC<LyricsEditorProps> = ({ onClose }) => {
    const { 
        tracks, lyrics, setLyrics, currentTime, updateLyricBlock, removeLyricBlock, 
        addLyricBlock, clearLyrics, lyricsSettings, setLyricsSettings 
    } = useAudioEngine();

    const [view, setView] = useState<EditorView>(lyrics.length > 0 ? 'editor' : 'choose');
    const [rawText, setRawText] = useState('');
    const [linesPerBlock, setLinesPerBlock] = useState<1 | 2>(2);
    const [showFontPicker, setShowFontPicker] = useState(false);
    const [isSyncingAI, setIsSyncingAI] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState('');
    const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
    const [useAutoSelect, setUseAutoSelect] = useState(true);
    const [trackSelectPurpose, setTrackSelectPurpose] = useState<'transcribe' | 'align'>('transcribe');

    const VOCAL_REGEX = /vox|voz|vocal|vocals|choir|bgvs/i;

    // Todos los canales que parecen ser de voz
    const vocalTracks = useMemo(() => {
        return tracks.filter(t => t.buffer && VOCAL_REGEX.test(t.name));
    }, [tracks]);

    // Para compatibilidad con el modo de insertar texto, el primero disponible
    const vocalTrack = vocalTracks[0] ?? null;

    // ──────────────────────────────────────────────────────────
    // Sincronización: IA transcribe con los canales seleccionados
    // ──────────────────────────────────────────────────────────
    const handleAISyncTranscribe = async () => {
        let buffersToUse: AudioBuffer[];
        if (useAutoSelect) {
            buffersToUse = vocalTracks.map(t => t.buffer!).filter(Boolean);
        } else {
            buffersToUse = vocalTracks
                .filter(t => selectedTrackIds.includes(t.id))
                .map(t => t.buffer!)
                .filter(Boolean);
        }
        if (buffersToUse.length === 0) return;

        setIsSyncingAI(true);
        setSyncProgress(0);
        setSyncStatus('Procesando audio...');
        try {
            const result = await processVocalTrackForAI(buffersToUse, '', 'transcribe', (p) => {
                setSyncProgress(p);
                if (p < 10) setSyncStatus('Mezclando canales...');
                else if (p < 40) setSyncStatus('Preparando audio...');
                else if (p < 80) setSyncStatus('Enviando a Gemini...');
                else setSyncStatus('Esperando respuesta de la IA...');
            });
            setIsSyncingAI(false);
            if (result.length > 0) {
                const newBlocks: LyricBlock[] = result.map((b) => ({
                    id: crypto.randomUUID(),
                    text: b.text,
                    startTime: b.startTime,
                }));
                setLyrics(newBlocks);
                setView('editor');
            } else {
                alert("La IA no detectó texto. Intenta con el modo 'Insertar Texto'.");
                setView('choose');
            }
        } catch (error) {
            console.error("AI Sync Error:", error);
            alert("Error al contactar la IA. Verifica tu API Key y conexión.");
            setIsSyncingAI(false);
        }
    };

    // Sincronización: usuario pega texto → IA alinea los tiempos
    // Acepta buffers externos (cuando viene desde choose-track) o usa vocalTrack por defecto
    // ──────────────────────────────────────────────────────────
    const handlePasteAndAlign = async (externalBuffers?: AudioBuffer[]) => {
        if (!rawText.trim()) return;

        // Paso 1: formatear el texto en bloques
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const formattedLines: string[] = [];
        for (let i = 0; i < lines.length; i += linesPerBlock) {
            const line1 = lines[i];
            const line2 = (linesPerBlock === 2 && lines[i + 1]) ? '\n' + lines[i + 1] : '';
            formattedLines.push(line1 + line2);
        }

        // Determinar qué buffers usar
        const buffersToUse: AudioBuffer[] = externalBuffers ?? (vocalTrack?.buffer ? [vocalTrack.buffer] : []);

        // Sin pista vocal: guardar bloques sin tiempos
        if (buffersToUse.length === 0) {
            const newBlocks: LyricBlock[] = formattedLines.map(t => ({
                id: crypto.randomUUID(), text: t, startTime: null
            }));
            setLyrics(prev => [...prev, ...newBlocks]);
            setRawText('');
            setView('editor');
            return;
        }

        // Paso 2: enviar a la IA para alineación
        setIsSyncingAI(true);
        setSyncProgress(0);
        setSyncStatus('Preparando audio para la IA...');

        try {
            const lyricsText = formattedLines.join('\n');
            const result = await processVocalTrackForAI(
                buffersToUse,
                lyricsText,
                'align',
                (p) => {
                    setSyncProgress(p);
                    if (p < 10) setSyncStatus('Mezclando canales...');
                    else if (p < 40) setSyncStatus('Preparando audio...');
                    else if (p < 80) setSyncStatus('Enviando letras y audio a Gemini...');
                    else setSyncStatus('La IA está alineando los tiempos...');
                }
            );
            setIsSyncingAI(false);

            if (result.length > 0) {
                const newBlocks: LyricBlock[] = result.map(b => ({
                    id: crypto.randomUUID(),
                    text: b.text,
                    startTime: b.startTime,
                }));
                setLyrics(prev => [...prev, ...newBlocks]);
                setRawText('');
                setView('editor');
            } else {
                const newBlocks: LyricBlock[] = formattedLines.map(t => ({
                    id: crypto.randomUUID(), text: t, startTime: null
                }));
                setLyrics(prev => [...prev, ...newBlocks]);
                setRawText('');
                setView('editor');
                alert("La IA no pudo alinear los tiempos. Los bloques se guardaron sin tiempo — puedes mapearlos manualmente.");
            }
        } catch (error) {
            console.error("Align Error:", error);
            setIsSyncingAI(false);
            const newBlocks: LyricBlock[] = formattedLines.map(t => ({
                id: crypto.randomUUID(), text: t, startTime: null
            }));
            setLyrics(prev => [...prev, ...newBlocks]);
            setRawText('');
            setView('editor');
            alert("Hubo un error con la IA, los bloques se guardaron sin tiempo. Puedes mapearlos manualmente.");
        }
    };

    // Helper: resuelve los buffers seleccionados en choose-track
    const getSelectedBuffers = (): AudioBuffer[] => {
        if (useAutoSelect) return vocalTracks.map(t => t.buffer!).filter(Boolean);
        return vocalTracks.filter(t => selectedTrackIds.includes(t.id)).map(t => t.buffer!).filter(Boolean);
    };

    const formatTime = (t: number | null) => {
        if (t === null) return '--:--';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 10);
        return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    };

    // ──────────────────────────────────────────────────────────
    // RENDER: pantalla de Loading de IA
    // ──────────────────────────────────────────────────────────
    if (isSyncingAI) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-purple-800/50 rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center">
                    <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90 absolute" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#3b0764" strokeWidth="6" />
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#a855f7" strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 34}`}
                                strokeDashoffset={`${2 * Math.PI * 34 * (1 - syncProgress / 100)}`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-purple-300 font-bold text-sm">{syncProgress}%</span>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-1">✨ Sincronizando con IA</h3>
                        <p className="text-purple-300 text-sm">{syncStatus}</p>
                    </div>
                    <p className="text-gray-500 text-xs">Gemini está analizando el audio. Esto puede tardar 10-30 segundos dependiendo de la duración de la canción.</p>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────
    // RENDER: pantalla de elección inicial
    // ──────────────────────────────────────────────────────────
    if (view === 'choose') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gray-950">
                        <h2 className="text-white font-bold text-base flex items-center gap-2">
                            <span>📝</span> Editor de Letras
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors">
                            Cerrar
                        </button>
                    </div>

                    <div className="p-6 flex flex-col gap-4">
                        <p className="text-gray-400 text-sm text-center mb-2">¿Cómo deseas agregar las letras?</p>

                        {/* Opción 1: IA completa */}
                        <button
                            onClick={() => { setTrackSelectPurpose('transcribe'); setView('choose-track'); }}
                            disabled={vocalTracks.length === 0}
                            className="group relative flex items-start gap-4 p-5 rounded-xl border border-purple-700/50 bg-purple-900/20 hover:bg-purple-900/40 hover:border-purple-600 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <div className="w-12 h-12 rounded-xl bg-purple-700/40 group-hover:bg-purple-700/60 flex items-center justify-center text-2xl shrink-0 transition-colors">✨</div>
                            <div>
                                <h3 className="text-white font-bold text-sm mb-1">Sincronizar con IA desde cero</h3>
                                <p className="text-purple-300/80 text-xs leading-relaxed">
                                    La IA escucha el canal de voz, transcribe la letra y asigna automáticamente los tiempos a cada frase.
                                    {vocalTracks.length === 0
                                        ? <span className="block text-red-400 mt-1">⚠ Requiere un canal de voz (vox, vocal, choir, bgvs)</span>
                                        : <span className="block text-purple-400/70 mt-1">{vocalTracks.length} canal{vocalTracks.length > 1 ? 'es' : ''} de voz detectado{vocalTracks.length > 1 ? 's' : ''}</span>
                                    }
                                </p>
                            </div>
                        </button>

                        {/* Opción 2: Insertar texto + alineación IA */}
                        <button
                            onClick={() => { setView('manual-paste'); }}
                            className="group flex items-start gap-4 p-5 rounded-xl border border-blue-700/50 bg-blue-900/20 hover:bg-blue-900/40 hover:border-blue-600 transition-all text-left"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-700/40 group-hover:bg-blue-700/60 flex items-center justify-center text-2xl shrink-0 transition-colors">📋</div>
                            <div>
                                <h3 className="text-white font-bold text-sm mb-1">Insertar letra y alinear con IA</h3>
                                <p className="text-blue-300/80 text-xs leading-relaxed">
                                    Pegas el texto de la canción y la IA acomoda automáticamente cada frase al momento exacto en el que se canta.
                                    {!vocalTrack && <span className="block text-yellow-400/80 mt-1">Sin canal de voz: se guardarán sin tiempo para mapear manualmente.</span>}
                                </p>
                            </div>
                        </button>

                        {lyrics.length > 0 && (
                            <button
                                onClick={() => setView('editor')}
                                className="text-gray-400 hover:text-white text-xs text-center py-2 transition-colors"
                            >
                                → Ver letras existentes ({lyrics.length} bloques)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────
    // RENDER: selección de canales vocales
    // ──────────────────────────────────────────────────────────
    if (view === 'choose-track') {
        const toggleTrack = (id: string) => {
            setSelectedTrackIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            );
        };

        const canProceed = useAutoSelect || selectedTrackIds.length > 0;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setView('choose')} className="text-gray-400 hover:text-white text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                                ← Volver
                            </button>
                            <h2 className="text-white font-bold text-sm">🎙️ Canal de Voz</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors">Cerrar</button>
                    </div>

                    <div className="p-5 flex flex-col gap-3">
                        <p className="text-gray-400 text-xs mb-1">Selecciona qué canal(es) de voz deseas que la IA analice:</p>

                        {/* Opción: Auto */}
                        <button
                            onClick={() => setUseAutoSelect(true)}
                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                                useAutoSelect
                                    ? 'border-purple-500 bg-purple-900/40 ring-1 ring-purple-500/50'
                                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${useAutoSelect ? 'border-purple-400 bg-purple-400' : 'border-gray-500'}`}>
                                {useAutoSelect && <div className="w-2 h-2 rounded-full bg-white"/>}
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">🤖 Automático (recomendado)</p>
                                <p className="text-gray-400 text-xs">La IA analiza todos los canales de voz detectados a la vez — ideal si tienes varios.</p>
                            </div>
                        </button>

                        {/* Separador */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-gray-700"/>
                            <span className="text-gray-500 text-xs">o elegir manualmente</span>
                            <div className="flex-1 h-px bg-gray-700"/>
                        </div>

                        {/* Lista de canales vocales */}
                        <div className="flex flex-col gap-2">
                            {vocalTracks.map(track => {
                                const isSelected = selectedTrackIds.includes(track.id);
                                return (
                                    <button
                                        key={track.id}
                                        onClick={() => { setUseAutoSelect(false); toggleTrack(track.id); }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                            !useAutoSelect && isSelected
                                                ? 'border-blue-500 bg-blue-900/30 ring-1 ring-blue-500/40'
                                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            !useAutoSelect && isSelected
                                                ? 'border-blue-400 bg-blue-500'
                                                : 'border-gray-500'
                                        }`}>
                                            {!useAutoSelect && isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{track.name}</p>
                                            <p className="text-gray-500 text-xs">{track.buffer ? `${track.buffer.duration.toFixed(1)}s · ${track.buffer.numberOfChannels}ch` : ''}</p>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-800/50 shrink-0">Voz</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => {
                                if (trackSelectPurpose === 'align') {
                                    handlePasteAndAlign(getSelectedBuffers());
                                } else {
                                    handleAISyncTranscribe();
                                }
                            }}
                            disabled={!canProceed}
                            className="mt-2 w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-500 text-white"
                        >
                            {trackSelectPurpose === 'align'
                                ? useAutoSelect
                                    ? `✨ Alinear letra con ${vocalTracks.length > 1 ? `${vocalTracks.length} canales` : 'el canal'}`
                                    : selectedTrackIds.length > 0
                                        ? `✨ Alinear con ${selectedTrackIds.length} canal${selectedTrackIds.length > 1 ? 'es' : ''} seleccionado${selectedTrackIds.length > 1 ? 's' : ''}`
                                        : 'Selecciona al menos un canal'
                                : useAutoSelect
                                    ? `✨ Analizar ${vocalTracks.length > 1 ? `${vocalTracks.length} canales` : 'el canal'} automáticamente`
                                    : selectedTrackIds.length > 0
                                        ? `✨ Analizar ${selectedTrackIds.length} canal${selectedTrackIds.length > 1 ? 'es' : ''} seleccionado${selectedTrackIds.length > 1 ? 's' : ''}`
                                        : 'Selecciona al menos un canal'
                            }
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────
    // RENDER: pantalla de pegado de texto
    // ──────────────────────────────────────────────────────────
    if (view === 'manual-paste') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setView('choose')} className="text-gray-400 hover:text-white text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                                ← Volver
                            </button>
                            <h2 className="text-white font-bold text-sm">📋 Insertar Letra</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors">
                            Cerrar
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <label className="text-gray-300 text-xs font-bold">Pega aquí la letra completa:</label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs">Agrupar en:</span>
                                <select
                                    className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-xs rounded border border-gray-700 px-2 py-1 outline-none font-medium"
                                    value={linesPerBlock}
                                    onChange={(e) => setLinesPerBlock(Number(e.target.value) as 1 | 2)}
                                >
                                    <option value={1}>1 renglón</option>
                                    <option value={2}>2 renglones</option>
                                </select>
                            </div>
                        </div>

                        <textarea
                            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 min-h-[250px] font-sans resize-none"
                            placeholder={`Pega el texto aquí...\nEl sistema separará automáticamente la letra en bloques de ${linesPerBlock} rengl${linesPerBlock === 1 ? 'ón' : 'ones'}.`}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />

                        {vocalTrack ? (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40">
                                <span className="text-blue-400 text-lg shrink-0">✨</span>
                                <p className="text-blue-300/80 text-xs leading-relaxed">
                                    Canal de voz detectado: <span className="font-bold text-blue-300">"{vocalTrack.name}"</span>. Al confirmar, la IA alineará automáticamente los bloques con los tiempos correctos del audio.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-950/30 border border-yellow-800/30">
                                <span className="text-yellow-400 text-lg shrink-0">⚠</span>
                                <p className="text-yellow-300/80 text-xs leading-relaxed">
                                    No se detectó canal de voz. Los bloques se guardarán sin tiempos y podrás asignarlos manualmente presionando "↓ Mapear".
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 p-4 border-t border-gray-800 shrink-0">
                        <button
                            onClick={() => setView('choose')}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                if (vocalTracks.length > 0) {
                                    setTrackSelectPurpose('align');
                                    setView('choose-track');
                                } else {
                                    handlePasteAndAlign();
                                }
                            }}
                            disabled={!rawText.trim()}
                            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            {vocalTracks.length > 0 ? '✨ Seleccionar canal y Alinear' : 'Guardar Bloques'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────
    // RENDER: editor principal de bloques
    // ──────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-800 bg-gray-950">
                    <h2 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
                        <span>📝</span> Editor de Letras
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs">
                        Cerrar
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-900">
                    <div className="flex flex-col gap-2 relative">
                        {/* Barra de controles */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center sticky top-0 bg-gray-900 pb-2 z-10 border-b border-gray-800 mb-2 gap-2">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <span className="text-gray-400 text-xs mr-1 sm:mr-2">{lyrics.length} blq.</span>
                                
                                <select className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                    value={lyricsSettings.position}
                                    onChange={e => setLyricsSettings({...lyricsSettings, position: e.target.value as any})}
                                    title="Posición de Letra">
                                    <option value="top">Arriba</option>
                                    <option value="middle">Centro</option>
                                    <option value="bottom">Abajo</option>
                                </select>
                                <select className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                    value={lyricsSettings.align}
                                    onChange={e => setLyricsSettings({...lyricsSettings, align: e.target.value as any})}
                                    title="Alineación">
                                    <option value="left">Izq.</option>
                                    <option value="center">Centrado</option>
                                    <option value="right">Der.</option>
                                </select>
                                <div className="flex items-center gap-1 bg-gray-800 rounded border border-gray-700 px-1 py-0.5 sm:py-1" title="Tamaño (pt)">
                                    <span className="text-[10px] text-gray-400 hidden sm:inline">Aa</span>
                                    <input type="number" className="bg-transparent text-gray-200 text-[10px] sm:text-xs outline-none w-8 sm:w-10 text-center font-mono"
                                        value={lyricsSettings.fontSize}
                                        onChange={e => setLyricsSettings({...lyricsSettings, fontSize: Number(e.target.value) || 60})} />
                                </div>
                                <button onClick={() => setShowFontPicker(true)}
                                    className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-2 py-0.5 sm:py-1 outline-none font-bold min-w-[80px]"
                                    title="Cambiar Fuente">
                                    Font: {lyricsSettings.fontFamily.split(',')[0].replace(/['\"]/g, '')}
                                </button>
                                {showFontPicker && (
                                    <FontPicker currentFont={lyricsSettings.fontFamily}
                                        onSelect={(fontName) => { setLyricsSettings({ ...lyricsSettings, fontFamily: `'${fontName}', sans-serif` }); setShowFontPicker(false); }}
                                        onClose={() => setShowFontPicker(false)} />
                                )}
                                <select className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                    value={lyricsSettings.animation}
                                    onChange={e => setLyricsSettings({...lyricsSettings, animation: e.target.value as any})}
                                    title="Animación de Entrada">
                                    <option value="none">Sin Entrada</option>
                                    <option value="blur-in">Blur Moderno</option>
                                    <option value="slide-up">Deslizamiento</option>
                                    <option value="zoom-in">Zoom In</option>
                                </select>
                                <select className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                    value={lyricsSettings.idleAnimation || 'float-pulse-shine'}
                                    onChange={e => setLyricsSettings({...lyricsSettings, idleAnimation: e.target.value as any})}
                                    title="Animación Durante (Loop)">
                                    <option value="none">Sin Anim. Durante</option>
                                    <option value="float-pulse-shine">Flotante + Brillo</option>
                                    <option value="zoom-in-slow">Zoom Suave (In)</option>
                                    <option value="zoom-out-slow">Zoom Suave (Out)</option>
                                </select>
                                <select className="bg-gray-800 hover:bg-gray-700 transition cursor-pointer text-gray-200 text-[10px] sm:text-xs rounded border border-gray-700 px-1 py-0.5 sm:py-1 outline-none font-medium ml-1"
                                    value={lyricsSettings.exitAnimation || 'slide-down-stagger'}
                                    onChange={e => setLyricsSettings({...lyricsSettings, exitAnimation: e.target.value as any})}
                                    title="Animación de Salida">
                                    <option value="none">Sin Salida</option>
                                    <option value="slide-down-stagger">Desplazar Abajo</option>
                                </select>
                                {/* ─── Kinetic Typography ─── */}
                                <div className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-600">
                                    <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider hidden sm:inline">KT</span>
                                    <select className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                        value={lyricsSettings.kineticMode || 'none'}
                                        onChange={e => setLyricsSettings({...lyricsSettings, kineticMode: e.target.value as any})}
                                        title="Kinetic Typography">
                                        <option value="none">Sin Kinetic</option>
                                        <option value="by-word">Por Palabra</option>
                                        <option value="by-letter">Por Letra</option>
                                    </select>
                                    {(lyricsSettings.kineticMode && lyricsSettings.kineticMode !== 'none') && (<>
                                        <select className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                            value={lyricsSettings.kineticAnimation || 'wave'}
                                            onChange={e => setLyricsSettings({...lyricsSettings, kineticAnimation: e.target.value as any})}>
                                            <option value="wave">🌊 Wave</option>
                                            <option value="fall-in">⬇ Fall In</option>
                                            <option value="bounce">🏀 Bounce</option>
                                            <option value="flip">🔄 Flip 3D</option>
                                            <option value="glitch-reveal">⚡ Glitch</option>
                                            <option value="slide-cascade">➡ Cascade</option>
                                        </select>
                                        <div className="flex items-center gap-0.5 bg-purple-900/30 rounded border border-purple-700/50 px-1 py-0.5">
                                            <span className="text-[9px] text-purple-400 hidden sm:inline">⏱</span>
                                            <input type="number" min={10} max={300} step={5}
                                                className="bg-transparent text-purple-200 text-[10px] sm:text-xs outline-none w-8 text-center font-mono"
                                                value={lyricsSettings.kineticStagger ?? 40}
                                                onChange={e => setLyricsSettings({...lyricsSettings, kineticStagger: Math.max(10, Math.min(300, Number(e.target.value) || 40))})} />
                                            <span className="text-[8px] text-purple-500 hidden sm:inline">ms</span>
                                        </div>
                                        <select className="bg-purple-900/40 hover:bg-purple-800/50 transition cursor-pointer text-purple-200 text-[10px] sm:text-xs rounded border border-purple-700/60 px-1 py-0.5 sm:py-1 outline-none font-medium"
                                            value={lyricsSettings.kineticExitAnimation || 'wave-out'}
                                            onChange={e => setLyricsSettings({...lyricsSettings, kineticExitAnimation: e.target.value as any})}>
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

                            {/* Acciones de la barra */}
                            <div className="flex gap-2 items-center shrink-0">
                                <button
                                    onClick={() => setView('choose')}
                                    className="px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-400 rounded text-[10px] sm:text-xs font-bold transition-colors border border-blue-800/40"
                                >
                                    + Agregar
                                </button>
                                {vocalTrack && (
                                    <button
                                        onClick={handleAISyncTranscribe}
                                        className="px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors bg-purple-600 hover:bg-purple-500 text-white"
                                        title="Re-sincronizar todo con IA"
                                    >
                                        ✨ IA
                                    </button>
                                )}
                                <button
                                    onClick={() => { if (confirm('¿Estás seguro de que quieres borrar TODA la letra?')) clearLyrics(); }}
                                    className="px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-900/50 rounded text-[10px] sm:text-xs font-bold transition-colors"
                                >
                                    Vaciar
                                </button>
                            </div>
                        </div>

                        {/* Lista de bloques */}
                        {lyrics.map((block, idx) => (
                            <div key={block.id} className="flex gap-2 items-start bg-gray-800/50 p-2 sm:p-3 rounded border border-gray-700/50 group">
                                <div className="flex flex-col items-center justify-center gap-1 shrink-0 w-12 sm:w-16">
                                    <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">#{idx+1}</span>
                                    <div className={`text-[10px] sm:text-xs font-mono font-bold px-1 py-0.5 rounded w-full text-center ${block.startTime !== null ? 'text-green-400 bg-gray-950' : 'text-yellow-600 bg-gray-950'}`}>
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
                        {lyrics.length === 0 && (
                            <div className="text-center p-8 text-gray-500 text-sm">
                                No hay bloques de letra. <button onClick={() => setView('choose')} className="text-blue-400 hover:underline">Agregar letras</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
