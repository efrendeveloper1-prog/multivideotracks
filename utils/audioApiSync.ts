/**
 * Mezcla múltiples AudioBuffers en uno solo (útil para analizar canales vocales combinados).
 */
async function mixBuffers(buffers: AudioBuffer[]): Promise<AudioBuffer> {
    if (buffers.length === 1) return buffers[0];
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const maxDuration = Math.max(...buffers.map(b => b.duration));
    const sampleRate = buffers[0].sampleRate;
    const totalSamples = Math.ceil(maxDuration * sampleRate);
    const mixCtx = new OfflineCtx(1, totalSamples, sampleRate);

    // Factor de ganancia suave para no atenuar demasiado la voz principal
    const gainFactor = 1 / Math.sqrt(buffers.length);

    for (const buf of buffers) {
        const src = mixCtx.createBufferSource();
        src.buffer = buf;
        const gain = mixCtx.createGain();
        gain.gain.value = gainFactor;
        src.connect(gain);
        gain.connect(mixCtx.destination);
        src.start();
    }
    return mixCtx.startRendering();
}

/**
 * Aplica anticipación visual a las marcas de tiempo para que la frase aparezca
 * en pantalla antes de que el cantante empiece a cantar, permitiendo leer con anticipación.
 * Protege contra solapamientos con la frase anterior.
 */
export function applyReadingAnticipation(
    blocks: { text: string; startTime: number; endTime: number }[],
    leadTimeSeconds: number = 1.0
): { text: string; startTime: number; endTime: number }[] {
    if (!blocks || blocks.length === 0 || leadTimeSeconds <= 0) return blocks;

    // Asegurar orden cronológico
    const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);

    return sorted.map((block, i) => {
        const originalStart = block.startTime;
        const originalEnd = block.endTime;

        // Fin del bloque anterior para evitar solapamientos
        const prevBlock = i > 0 ? sorted[i - 1] : null;
        const prevEnd = prevBlock ? prevBlock.endTime : 0;

        // Margen mínimo para que no se superponga con el anterior
        const minAllowedStart = i === 0 ? 0 : Math.max(0, prevEnd + 0.05);

        // Adelantar el tiempo de inicio por leadTimeSeconds
        const targetStart = Math.max(minAllowedStart, originalStart - leadTimeSeconds);

        const finalStart = Number(targetStart.toFixed(2));
        const finalEnd = Number(Math.max(finalStart + 0.5, originalEnd).toFixed(2));

        return {
            ...block,
            startTime: finalStart,
            endTime: finalEnd,
        };
    });
}

/**
 * Procesa uno o más buffers de audio con la IA de Gemini.
 * Optimiza y normaliza el audio antes de enviarlo.
 */
export async function processVocalTrackForAI(
    bufferOrBuffers: AudioBuffer | AudioBuffer[],
    lyricsText: string,
    mode: 'transcribe' | 'align',
    onProgress: (progress: number) => void,
    leadTime: number = 1.0
): Promise<{ text: string; startTime: number; endTime: number }[]> {

    onProgress(5);

    // Resolver el buffer final (mezclar si son múltiples)
    const buffers = Array.isArray(bufferOrBuffers) ? bufferOrBuffers : [bufferOrBuffers];
    const validBuffers = buffers.filter(b => b && b.duration > 0);
    if (validBuffers.length === 0) {
        throw new Error("No se proporcionó ningún buffer de audio válido para analizar.");
    }

    const inputBuffer = validBuffers.length > 1 ? await mixBuffers(validBuffers) : validBuffers[0];

    onProgress(15);

    // Frecuencia de muestreo adaptativa: 16kHz estándar, o 12kHz si la pista es muy larga (> 5 min)
    // para asegurar que el payload base64 permanezca siempre por debajo del límite de Gemini.
    const TARGET_SAMPLE_RATE = inputBuffer.duration > 300 ? 12000 : 16000;
    const totalSamples = Math.ceil(inputBuffer.duration * TARGET_SAMPLE_RATE);
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtx(1, totalSamples, TARGET_SAMPLE_RATE);

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    onProgress(40);

    // Extraer samples
    const samples = new Float32Array(renderedBuffer.length);
    renderedBuffer.copyFromChannel(samples, 0, 0);

    // 1. Detección de silencio y normalización de volumen (Peak Normalization a 0.95)
    let maxAmp = 0;
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > maxAmp) maxAmp = abs;
    }

    if (maxAmp < 0.0001) {
        throw new Error("El canal de audio seleccionado está completamente en silencio. Por favor selecciona una pista con audio audible.");
    }

    const ratio = 0.95 / maxAmp;
    for (let i = 0; i < samples.length; i++) {
        samples[i] *= ratio;
    }

    onProgress(55);
    const wavBlob = encodeWAV(samples, TARGET_SAMPLE_RATE);
    onProgress(65);

    const formData = new FormData();
    formData.append('audio', wavBlob, 'audio_track.wav');
    formData.append('mode', mode);
    formData.append('leadTime', leadTime.toString());
    if (mode === 'align' && lyricsText) {
        formData.append('lyrics', lyricsText);
    }

    onProgress(75);
    const res = await fetch('/api/sync-lyrics', {
        method: 'POST',
        body: formData
    });

    onProgress(95);

    let data: any;
    try {
        data = await res.json();
    } catch {
        const text = await res.text().catch(() => '');
        throw new Error(`Error en el servidor (${res.status}): ${text.substring(0, 150) || 'Sin respuesta'}`);
    }

    onProgress(100);

    if (!res.ok || !data.success) {
        throw new Error(data?.error || `El servidor respondió con código ${res.status}`);
    }

    if (data.blocks && Array.isArray(data.blocks)) {
        return data.blocks.map((b: any) => ({
            text: String(b.text || '').trim(),
            startTime: Number(b.startTime) || 0,
            endTime: Number(b.endTime) || 0
        })).filter((b: any) => b.text.length > 0);
    }

    return [];
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (v: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) v.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
}
