export async function processVocalTrackForAI(
    buffer: AudioBuffer,
    lyricsText: string,
    mode: 'transcribe' | 'align',
    onProgress: (progress: number) => void
): Promise<{ text: string, startTime: number, endTime: number }[]> {
    
    // Usamos 8kHz mono para asegurar que un audio de varios minutos ronde los ~3.5MB.
    // Esto es vital para evitar el error de Payload Too Large (6MB limit) en Netlify Serverless Functions.
    onProgress(10);
    const TARGET_SAMPLE_RATE = 8000;
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtx(1, buffer.duration * TARGET_SAMPLE_RATE, TARGET_SAMPLE_RATE);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    const renderedBuffer = await offlineCtx.startRendering();
    onProgress(40);
    
    // Convertir a WAV TODO UNA VEZ (sin chunks) porque Gemini 1.5 en el backend puede leerlo de un golpe
    const chunkBuffer = new Float32Array(renderedBuffer.length);
    renderedBuffer.copyFromChannel(chunkBuffer, 0, 0);
    
    const wavBlob = encodeWAV(chunkBuffer, TARGET_SAMPLE_RATE);
    onProgress(60);
    
    const formData = new FormData();
    formData.append('audio', wavBlob, 'vocal_track_8khz.wav');
    formData.append('mode', mode);
    if (mode === 'align' && lyricsText) {
        formData.append('lyrics', lyricsText);
    }
    
    try {
        onProgress(80); // Enviando a Netlify Serverless API
        
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

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
}
