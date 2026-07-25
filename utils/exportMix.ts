import { Track, CutRegion, Song } from '@/hooks/useAudioEngine';
import { AudioAnalysis } from '@/utils/audioAnalysis';

interface ExportParams {
    activeSongId: string | null;
    playlist: Song[];
    tracks: Track[];
    duration: number;
    cutRegions: CutRegion[];
    masterVolume: number;
    isCountInEnabled: boolean;
    countInClicks: number;
    songAnalysis: AudioAnalysis | null;
    videoOffset: number;
    videoEndTime: number;
    videoDuration: number;
    videoFadeIn: number;
    videoFadeOut: number;
    videoFadeInType: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp';
    videoFadeOutType: 'linear' | 'fast' | 'slow' | 'smooth' | 'sharp';
    audioContext: AudioContext;
    setExportStatus: (status: string) => void;
    setExportProgress: (progress: number) => void;
    setIsExporting: (exporting: boolean) => void;
    pitchShift: number;
    playbackRate: number;
}

const loadLamejs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
        if ((window as any).lamejs) {
            resolve((window as any).lamejs);
            return;
        }
        const existingScript = document.getElementById('lamejs-script');
        if (existingScript) {
            let retries = 0;
            const interval = setInterval(() => {
                if ((window as any).lamejs) {
                    clearInterval(interval);
                    resolve((window as any).lamejs);
                } else if (retries > 50) {
                    clearInterval(interval);
                    reject(new Error('lamejs timed out loading'));
                }
                retries++;
            }, 100);
            return;
        }
        const script = document.createElement('script');
        script.id = 'lamejs-script';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
        script.onload = () => {
            if ((window as any).lamejs) {
                resolve((window as any).lamejs);
            } else {
                reject(new Error('lamejs not found on window object after loading'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load lamejs script from CDN'));
        document.head.appendChild(script);
    });
};

const getSoundTouchLatency = (sampleRate: number): number => {
    const tempo = 1;
    const overlapMs = 8;
    
    const AUTOSEQ_C = 130;
    const AUTOSEQ_K = -20;
    const AUTOSEQ_AT_MIN = 125;
    const AUTOSEQ_AT_MAX = 50;
    
    let seq = AUTOSEQ_C + AUTOSEQ_K * tempo;
    seq = seq < AUTOSEQ_AT_MAX ? AUTOSEQ_AT_MAX : (seq > AUTOSEQ_AT_MIN ? AUTOSEQ_AT_MIN : seq);
    const sequenceMs = Math.floor(seq + 0.5);
    
    const AUTOSEEK_C = 25.66666667;
    const AUTOSEEK_K = -2.666666667;
    const AUTOSEEK_AT_MIN = 25;
    const AUTOSEEK_AT_MAX = 15;
    
    let seek = AUTOSEEK_C + AUTOSEEK_K * tempo;
    seek = seek < AUTOSEEK_AT_MAX ? AUTOSEEK_AT_MAX : (seek > AUTOSEEK_AT_MIN ? AUTOSEEK_AT_MIN : seek);
    const seekWindowMs = Math.floor(seek + 0.5);
    
    const seekWindowLength = Math.floor(sampleRate * sequenceMs / 1000);
    const seekLength = Math.floor(sampleRate * seekWindowMs / 1000);
    
    let overlapLength = sampleRate * overlapMs / 1000;
    overlapLength = overlapLength < 16 ? 16 : overlapLength;
    overlapLength -= overlapLength % 8;
    
    const nominalSkip = tempo * (seekWindowLength - overlapLength);
    const intskip = Math.floor(nominalSkip + 0.5);
    const sampleReq = Math.max(intskip + overlapLength, seekWindowLength) + seekLength;
    
    const N = overlapLength + sampleReq;
    const K = Math.ceil(N / 128);
    const latencySamples = (K - 1) * 128;
    return latencySamples / sampleRate;
};

export async function performExportMixToMp3(params: ExportParams) {
    const {
        activeSongId,
        playlist,
        tracks,
        duration,
        cutRegions,
        masterVolume,
        isCountInEnabled,
        countInClicks,
        songAnalysis,
        videoOffset,
        videoEndTime,
        videoDuration,
        videoFadeIn,
        videoFadeOut,
        videoFadeInType,
        videoFadeOutType,
        audioContext,
        setExportStatus,
        setExportProgress,
        setIsExporting,
        pitchShift,
        playbackRate
    } = params;

    if (!activeSongId || tracks.length === 0) return;

    const activeSong = playlist.find(s => s.id === activeSongId);
    if (!activeSong) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Calculando regiones...');

    try {
        const sortedCuts = [...cutRegions].sort((a, b) => a.start - b.start);

        // Merge overlapping/adjacent cut regions
        const mergedCuts: CutRegion[] = [];
        for (const cut of sortedCuts) {
            if (cut.start >= duration) continue;
            const end = Math.min(cut.end, duration);
            if (end <= cut.start) continue;

            if (mergedCuts.length === 0) {
                mergedCuts.push({ start: cut.start, end });
            } else {
                const last = mergedCuts[mergedCuts.length - 1];
                if (cut.start <= last.end) {
                    last.end = Math.max(last.end, end);
                } else {
                    mergedCuts.push({ start: cut.start, end });
                }
            }
        }

        const baseBpm = songAnalysis?.bpm || 120;
        const currentBpm = baseBpm * playbackRate;
        const beatDuration = 60 / currentBpm;
        const countInDuration = isCountInEnabled ? countInClicks * beatDuration : 0;

        const uncutRegions: { start: number; end: number; outputStart: number }[] = [];
        let currentOutputTime = countInDuration;
        let lastEnd = 0;

        for (const cut of mergedCuts) {
            if (cut.start > lastEnd) {
                uncutRegions.push({
                    start: lastEnd,
                    end: cut.start,
                    outputStart: currentOutputTime
                });
                currentOutputTime += (cut.start - lastEnd) / playbackRate;
            }
            lastEnd = cut.end;
        }

        if (lastEnd < duration) {
            uncutRegions.push({
                start: lastEnd,
                end: duration,
                outputStart: currentOutputTime
            });
            currentOutputTime += (duration - lastEnd) / playbackRate;
        }

        const totalRenderDuration = currentOutputTime;

        if (totalRenderDuration <= 0) {
            throw new Error("No hay contenido de audio para exportar.");
        }

        setExportStatus('Renderizando mezcla...');
        const sampleRate = audioContext.sampleRate || 44100;

        const useSoundTouch = (pitchShift !== 0 || playbackRate !== 1);
        const latency = useSoundTouch ? getSoundTouchLatency(sampleRate) : 0;
        const mixLength = Math.ceil((totalRenderDuration + latency) * sampleRate);

        const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtx(2, mixLength, sampleRate);

        let SoundTouchNode: any = null;
        if (useSoundTouch) {
            setExportStatus('Inicializando procesador de tono/tempo...');
            const mod = await import('@soundtouchjs/audio-worklet');
            SoundTouchNode = mod.SoundTouchNode;
            await SoundTouchNode.register(offlineCtx, '/soundtouch-processor.js?v=2');
        }

        const masterGain = offlineCtx.createGain();
        masterGain.gain.setValueAtTime(masterVolume, 0);
        masterGain.connect(offlineCtx.destination);

        // 1. Schedule metronome clicks
        if (isCountInEnabled) {
            for (let i = 0; i < countInClicks; i++) {
                const clickTime = latency + i * beatDuration;
                const isFirstBeat = (i === 0);

                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.connect(gain);
                gain.connect(masterGain);

                osc.frequency.setValueAtTime(isFirstBeat ? 1200 : 800, clickTime);
                gain.gain.setValueAtTime(0.8, clickTime);
                gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.08);

                osc.start(clickTime);
                osc.stop(clickTime + 0.1);
            }
        }

        // 2. Schedule tracks
        const solo = tracks.some(t => t.soloed);
        for (const t of tracks) {
            const activeVolume = t.muted || (solo && !t.soloed) ? 0 : t.volume;
            if (activeVolume <= 0 || !t.buffer) continue;

            const gainNode = offlineCtx.createGain();
            const pannerNode = offlineCtx.createStereoPanner();
            pannerNode.pan.value = t.pan || 0;

            gainNode.connect(pannerNode);

            const isDrum = !!t.name.toLowerCase().match(/drum|bateria|perc|click|guia|cue|guide/);

            if (useSoundTouch && SoundTouchNode) {
                const stNode = new SoundTouchNode(offlineCtx);
                stNode.playbackRate.value = playbackRate;
                stNode.pitchSemitones.value = isDrum ? 0 : pitchShift;

                let delayNode: DelayNode | null = null;
                let targetDelay = 0;
                if (isDrum && playbackRate === 1 && pitchShift !== 0) {
                    targetDelay = latency;
                }
                if (targetDelay > 0) {
                    delayNode = offlineCtx.createDelay(1.0);
                    delayNode.delayTime.setValueAtTime(targetDelay, 0);
                }

                pannerNode.connect(stNode);
                if (delayNode) {
                    stNode.connect(delayNode);
                    delayNode.connect(masterGain);
                } else {
                    stNode.connect(masterGain);
                }
            } else {
                pannerNode.connect(masterGain);
            }

            if (t.isVideoAudio) {
                const vStart = Math.max(0, -videoOffset);

                const isInactive = (timeVal: number) => {
                    const vNow = timeVal + videoOffset;
                    return timeVal < vStart || timeVal >= videoEndTime || vNow < 0;
                };

                const getVideoVolumeFactor = (timeVal: number) => {
                    if (isInactive(timeVal)) return 0;
                    if (videoFadeIn > 0 && timeVal < vStart + videoFadeIn) {
                        const x = (timeVal - vStart) / videoFadeIn;
                        if (videoFadeInType === 'linear') return x;
                        if (videoFadeInType === 'fast') return 1 - (1 - x) * (1 - x);
                        if (videoFadeInType === 'slow') return x * x;
                        if (videoFadeInType === 'smooth') return x * x * (3 - 2 * x);
                        if (videoFadeInType === 'sharp') return Math.pow(x, 4);
                    }
                    if (videoFadeOut > 0 && timeVal > videoEndTime - videoFadeOut) {
                        const x = (timeVal - (videoEndTime - videoFadeOut)) / videoFadeOut;
                        if (videoFadeOutType === 'linear') return 1 - x;
                        if (videoFadeOutType === 'fast') return (1 - x) * (1 - x);
                        if (videoFadeOutType === 'slow') return 1 - x * x;
                        if (videoFadeOutType === 'smooth') return 1 - (x * x * (3 - 2 * x));
                        if (videoFadeOutType === 'sharp') return Math.pow(1 - x, 4);
                    }
                    return 1;
                };

                const gainValues: { time: number; value: number }[] = [];
                for (const region of uncutRegions) {
                    const regionPoints = [region.start, region.end];
                    const transitions = [vStart, vStart + videoFadeIn, videoEndTime - videoFadeOut, videoEndTime];
                    for (const tVal of transitions) {
                        if (tVal > region.start && tVal < region.end) {
                            regionPoints.push(tVal);
                        }
                    }
                    regionPoints.sort((a, b) => a - b);

                    const uniquePoints: number[] = [];
                    for (const p of regionPoints) {
                        if (uniquePoints.length === 0 || Math.abs(p - uniquePoints[uniquePoints.length - 1]) > 1e-5) {
                            uniquePoints.push(p);
                        }
                    }

                    for (const p of uniquePoints) {
                        const outTime = region.outputStart + (p - region.start) / playbackRate;
                        const factor = getVideoVolumeFactor(p);
                        gainValues.push({ time: outTime, value: activeVolume * factor });
                    }
                }

                if (gainValues.length > 0) {
                    if (gainValues[0].time > 0) {
                        gainNode.gain.setValueAtTime(0, 0);
                        gainNode.gain.setValueAtTime(0, gainValues[0].time - 0.001);
                    }
                    gainNode.gain.setValueAtTime(gainValues[0].value, gainValues[0].time);
                    for (let i = 1; i < gainValues.length; i++) {
                        const prev = gainValues[i - 1];
                        const curr = gainValues[i];
                        if (curr.time === prev.time) {
                            gainNode.gain.setValueAtTime(curr.value, curr.time);
                        } else {
                            gainNode.gain.linearRampToValueAtTime(curr.value, curr.time);
                        }
                    }
                }
            } else {
                gainNode.gain.setValueAtTime(activeVolume, 0);
            }

            for (const region of uncutRegions) {
                let when = region.outputStart;
                let offset = region.start;
                let dur = region.end - region.start;

                if (t.isVideoAudio) {
                    const sum = region.start + videoOffset;
                    if (sum >= 0) {
                        offset = sum;
                    } else {
                        const delay = Math.abs(sum);
                        if (delay < dur) {
                            when = region.outputStart + delay / playbackRate;
                            offset = 0;
                            dur = dur - delay;
                        } else {
                            continue;
                        }
                    }
                }

                const segmentSrc = offlineCtx.createBufferSource();
                segmentSrc.buffer = t.buffer;
                segmentSrc.playbackRate.value = playbackRate;
                segmentSrc.connect(gainNode);
                segmentSrc.start(when, offset, dur);
            }
        }

        const renderedBuffer = await offlineCtx.startRendering();

        setExportStatus('Cargando codificador MP3...');
        const lamejs = await loadLamejs();

        setExportStatus('Codificando a MP3...');
        const channels = 2;
        const kbps = 192;
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);

        const floatTo16BitPCM = (input: Float32Array): Int16Array => {
            const output = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            return output;
        };

        const left = floatTo16BitPCM(renderedBuffer.getChannelData(0));
        const right = floatTo16BitPCM(renderedBuffer.getChannelData(1));
        const mp3Data: Uint8Array[] = [];

        const sampleBlockSize = 1152;
        const totalBlocks = Math.ceil(left.length / sampleBlockSize);
        let processedBlocks = 0;

        for (let i = 0; i < left.length; i += sampleBlockSize * 10) {
            const endIdx = Math.min(left.length, i + sampleBlockSize * 10);
            for (let j = i; j < endIdx; j += sampleBlockSize) {
                const leftChunk = left.subarray(j, j + sampleBlockSize);
                const rightChunk = right.subarray(j, j + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf));
                }
                processedBlocks++;
            }
            setExportProgress(Math.round((processedBlocks / totalBlocks) * 100));
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(new Uint8Array(mp3buf));
        }

        setExportStatus('Descargando archivo...');
        const blob = new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSong.title || 'mix'}_mezcla.mp3`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setExportStatus('¡Exportación completada!');
        setTimeout(() => {
            setIsExporting(false);
        }, 1000);

    } catch (error) {
        console.error('Error exporting mix:', error);
        alert(`Error al exportar la mezcla: ${(error as any).message || error}`);
        setIsExporting(false);
    }
}
