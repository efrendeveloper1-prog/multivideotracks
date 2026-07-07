import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const AudioSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const {
        tracks,
        audioOutputDeviceId,
        setAudioOutputDevice,
        audioOutputMaxChannels,
        setTrackOutputChannel,
        countInOutputChannel,
        setCountInOutputChannel
    } = useAudioEngine();

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [requestingPermission, setRequestingPermission] = useState(false);

    useEffect(() => {
        const getDevices = async () => {
            try {
                let devs = await navigator.mediaDevices.enumerateDevices();
                
                // If devices have empty labels, we might need permission
                if (devs.length > 0 && devs[0].label === '') {
                    try {
                        setRequestingPermission(true);
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(t => t.stop());
                        devs = await navigator.mediaDevices.enumerateDevices();
                    } catch (e) {
                        console.warn("User denied audio permission or no mic available, device names might be hidden");
                    } finally {
                        setRequestingPermission(false);
                    }
                }
                
                setDevices(devs.filter(d => d.kind === 'audiooutput'));
            } catch (e) {
                console.error("Could not enumerate devices", e);
            }
        };
        
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    const channelPairs: number[] = [];
    for (let i = 0; i < Math.max(2, audioOutputMaxChannels); i += 2) {
        channelPairs.push(i);
    }
    
    // Sort tracks by name loosely
    const sortedTracks = [...tracks].sort((a,b) => {
        const isA = a.name.toLowerCase().match(/click|guia/);
        const isB = b.name.toLowerCase().match(/click|guia/);
        return (isA ? -1 : 0) - (isB ? -1 : 0);
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-400">
                            <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 0 1-.517.608 7.45 7.45 0 0 0-3.228 1.879.797.797 0 0 1-.797.161l-.549-.203a1.873 1.873 0 0 0-2.257 1.04l-1.42 3.32a1.873 1.873 0 0 0 .541 2.19l.48.363a.798.798 0 0 1 .27.738 7.45 7.45 0 0 0 0 3.746.798.798 0 0 1-.27.738l-.48.362a1.873 1.873 0 0 0-.542 2.19l1.42 3.32a1.873 1.873 0 0 0 2.257 1.04l.549-.203a.797.797 0 0 1 .798.161 7.45 7.45 0 0 0 3.228 1.879.798.798 0 0 1 .517.608l.092.549c.15.904.934 1.567 1.85 1.567h2.844c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 0 1 .517-.608 7.5 7.5 0 0 0 3.228-1.879.797.797 0 0 1 .798-.161l.549.203a1.873 1.873 0 0 0 2.257-1.04l1.42-3.32a1.873 1.873 0 0 0-.541-2.19l-.48-.363a.798.798 0 0 1-.27-.738 7.45 7.45 0 0 0 0-3.746.798.798 0 0 1 .27-.738l.48-.362a1.873 1.873 0 0 0 .542-2.19l-1.42-3.32a1.873 1.873 0 0 0-2.257-1.04l-.549.203a.797.797 0 0 1-.798-.161 7.45 7.45 0 0 0-3.228-1.879.798.798 0 0 1-.517-.608l-.092-.549a1.873 1.873 0 0 0-1.85-1.567h-2.844ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                        </svg>
                        Configuración de Audio
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 rounded-lg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Device Selection */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Dispositivo de Salida (Interfaz USB)</h3>
                        <div className="flex flex-col gap-2">
                            {devices.length === 0 ? (
                                <div className="p-4 bg-gray-800 rounded border border-gray-700 text-gray-400 text-sm">
                                    Buscando dispositivos... {requestingPermission && '(Solicitando permisos...)'}
                                </div>
                            ) : (
                                <select 
                                    className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    value={audioOutputDeviceId}
                                    onChange={(e) => setAudioOutputDevice(e.target.value)}
                                >
                                    {devices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId}>
                                            {d.label || `Dispositivo de Salida (${d.deviceId.slice(0,5)}...)`}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                Selecciona tu interfaz de audio USB. Canales disponibles detectados: <strong className="text-blue-400">{audioOutputMaxChannels}</strong>
                            </p>
                            {audioOutputMaxChannels <= 2 && (
                                <div className="mt-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded text-amber-400 text-xs">
                                    <strong>Nota:</strong> Tu navegador o dispositivo actual solo reporta 2 canales. Para enrutamiento avanzado, asegúrate de haber seleccionado una interfaz USB multicanal compatible.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Routing */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Enrutamiento por Pista</h3>
                        
                        <div className="space-y-2">
                            {/* Metronome Track (always present) */}
                            <div className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="font-medium text-gray-200">Cuenta Inicial (Metrónomo)</span>
                                </div>
                                <select
                                    className="bg-gray-900 border border-gray-600 text-gray-300 px-3 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    value={countInOutputChannel}
                                    onChange={(e) => setCountInOutputChannel(parseInt(e.target.value))}
                                >
                                    {channelPairs.map(ch => (
                                        <option key={ch} value={ch}>
                                            Salida {ch + 1}-{ch + 2} {ch === 0 ? '(Principal)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Song Tracks */}
                            {sortedTracks.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 bg-gray-800/10 rounded-lg border border-gray-800 border-dashed text-sm">
                                    No hay pistas cargadas. Carga un multitrack para configurar sus rutas.
                                </div>
                            ) : (
                                sortedTracks.map(track => {
                                    const outCh = track.outputChannel || 0;
                                    return (
                                        <div key={track.id} className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }}></div>
                                                <span className="font-medium text-gray-200">{track.name}</span>
                                            </div>
                                            <select
                                                className="bg-gray-900 border border-gray-600 text-gray-300 px-3 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                value={outCh}
                                                onChange={(e) => setTrackOutputChannel(track.id, parseInt(e.target.value))}
                                            >
                                                {channelPairs.map(ch => (
                                                    <option key={ch} value={ch}>
                                                        Salida {ch + 1}-{ch + 2} {ch === 0 ? '(Principal)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
