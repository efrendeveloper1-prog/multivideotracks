/**
 * Mezcla múltiples AudioBuffers en uno solo (útil para analizar todos los canales vocales a la vez).
 */
async function mixBuffers(buffers: AudioBuffer[]): Promise<AudioBuffer> {
    if (buffers.length === 1) return buffers[0];
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const maxLength = Math.max(...buffers.map(b => b.length));
    const sampleRate = buffers[0].sampleRate;
    const mixCtx = new OfflineCtx(1, maxLength, sampleRate);
    for (const buf of buffers) {
        const src = mixCtx.createBufferSource();
        src.buffer = buf;
        const gain = mixCtx.createGain();
        gain.gain.value = 1 / buffers.length; // Normalizar volumen al mezclar
        src.connect(gain);
        gain.connect(mixCtx.destination);
        src.start();
    }
    return mixCtx.startRendering();
}

/**
 * Procesa uno o más buffers de audio vocales con la IA de Gemini.
 * Si se reciben múltiples buffers, los mezcla antes de procesar.
 */
export async function processVocalTrackForAI(
    bufferOrBuffers: AudioBuffer | AudioBuffer[],
    lyricsText: string,
    mode: 'transcribe' | 'align',
    onProgress: (progress: number) => void
): Promise<{ text: string, startTime: number, endTime: number }[]> {

    onProgress(5);

    // Resolver el buffer final (mezclar si son múltiples)
    const buffers = Array.isArray(bufferOrBuffers) ? bufferOrBuffers : [bufferOrBuffers];
    const inputBuffer = buffers.length > 1 ? await mixBuffers(buffers) : buffers[0];

    onProgress(10);

    // 16kHz mono ofrece mejor calidad para que la IA detecte los tiempos con mayor precisión.
    // Un audio de 4 minutos a 16kHz mono pesa ~7.5MB en WAV, pero al ser base64 en JSON
    // sigue dentro de los límites aceptables para la mayoría de las funciones serverless.
    const TARGET_SAMPLE_RATE = 16000;
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtx(1, inputBuffer.duration * TARGET_SAMPLE_RATE, TARGET_SAMPLE_RATE);

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    onProgress(40);

    // Extraer samples
    const samples = new Float32Array(renderedBuffer.length);
    renderedBuffer.copyFromChannel(samples, 0, 0);

    // 1. Normalizar volumen para mejorar el reconocimiento (Peak Normalization a 0.95)
    let maxAmp = 0;
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > maxAmp) maxAmp = abs;
    }
    if (maxAmp > 0) {
        const ratio = 0.95 / maxAmp;
        for (let i = 0; i < samples.length; i++) {
            samples[i] *= ratio;
        }
    }

    const wavBlob = encodeWAV(samples, TARGET_SAMPLE_RATE);
    onProgress(60);

    const formData = new FormData();
    formData.append('audio', wavBlob, 'vocal_track_16khz.wav');
    formData.append('mode', mode);
    if (mode === 'align' && lyricsText) {
        formData.append('lyrics', lyricsText);
    }

    try {
        onProgress(80);
        const res = await fetch('/api/sync-lyrics', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            console.error("Error API:", await res.text());
            throw new Error(`API respondió con error: ${res.status}`);
        }

        const data = await res.json();
        onProgress(100);

        if (data.success && data.blocks) {
            return data.blocks.map((b: any) => ({
                text: b.text,
                startTime: Number(b.startTime),
                endTime: Number(b.endTime)
            }));
        } else {
            console.error("Backend devolvió error:", data);
            return [];
        }
    } catch (error) {
        console.error("Request error", error);
        return [];
    }
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
