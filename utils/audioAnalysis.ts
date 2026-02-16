/**
 * Audio analysis utilities for BPM and musical key detection.
 * Uses web-audio-beat-detector for BPM and spectral analysis for key.
 */

import { guess } from 'web-audio-beat-detector';

// Musical key names  
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles for major and minor keys
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface AudioAnalysis {
    bpm: number;
    key: string;       // e.g. "C", "F#", "Bb"
    scale: string;     // "Major" or "Minor"
    keyDisplay: string; // e.g. "C Major", "F#m"
}

/**
 * Detect BPM from an AudioBuffer using web-audio-beat-detector.
 */
async function detectBPM(buffer: AudioBuffer): Promise<number> {
    try {
        const result = await guess(buffer);
        return Math.round(result.bpm);
    } catch (e) {
        console.warn('BPM detection failed, trying fallback:', e);
        try {
            const result = await guess(buffer, 0, Math.min(buffer.duration, 15));
            return Math.round(result.bpm);
        } catch {
            return 0;
        }
    }
}

/**
 * Detect musical key using FFT-based chromagram analysis.
 * Uses OfflineAudioContext + AnalyserNode for efficient FFT.
 */
async function detectKey(buffer: AudioBuffer): Promise<{ key: string; scale: string; display: string }> {
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);

    // Create offline context to use AnalyserNode for FFT
    const fftSize = 4096;
    const chromagram = new Float64Array(12).fill(0);

    // Sample multiple windows across the track
    const totalFrames = channelData.length;
    const windowCount = Math.min(80, Math.floor(totalFrames / fftSize));
    const hopSize = Math.floor(totalFrames / windowCount);

    for (let w = 0; w < windowCount; w++) {
        const start = w * hopSize;
        const end = Math.min(start + fftSize, totalFrames);
        const segLen = end - start;

        // Apply Hanning window and compute power spectrum via simple FFT
        const windowed = new Float32Array(fftSize);
        for (let i = 0; i < segLen; i++) {
            windowed[i] = channelData[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (segLen - 1)));
        }

        // Compute magnitude spectrum using correlation with known note frequencies
        // Instead of full DFT, just check the 12 chroma pitch classes
        for (let note = 0; note < 12; note++) {
            // Check multiple octaves (2 through 6)
            for (let octave = 2; octave <= 6; octave++) {
                const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
                const bin = Math.round(freq * fftSize / sampleRate);
                if (bin <= 0 || bin >= fftSize / 2) continue;

                // Goertzel algorithm for single frequency magnitude — O(N) per frequency
                const k = bin;
                const w0 = 2 * Math.PI * k / fftSize;
                const coeff = 2 * Math.cos(w0);
                let s0 = 0, s1 = 0, s2 = 0;

                for (let i = 0; i < fftSize; i++) {
                    s0 = windowed[i] + coeff * s1 - s2;
                    s2 = s1;
                    s1 = s0;
                }

                const magnitude = Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
                chromagram[note] += magnitude;
            }
        }
    }

    // Normalize chromagram
    const maxChroma = Math.max(...chromagram);
    if (maxChroma > 0) {
        for (let i = 0; i < 12; i++) {
            chromagram[i] /= maxChroma;
        }
    }

    // Correlate with key profiles (Krumhansl-Kessler)
    let bestCorrelation = -Infinity;
    let bestKey = 0;
    let bestScale = 'Major';

    for (let key = 0; key < 12; key++) {
        const rotated = new Float64Array(12);
        for (let i = 0; i < 12; i++) {
            rotated[i] = chromagram[(i + key) % 12];
        }

        const majorCorr = correlate(rotated, MAJOR_PROFILE);
        if (majorCorr > bestCorrelation) {
            bestCorrelation = majorCorr;
            bestKey = key;
            bestScale = 'Major';
        }

        const minorCorr = correlate(rotated, MINOR_PROFILE);
        if (minorCorr > bestCorrelation) {
            bestCorrelation = minorCorr;
            bestKey = key;
            bestScale = 'Minor';
        }
    }

    const keyName = KEY_NAMES[bestKey];
    const displayKey = keyName.includes('#') ? toFlat(keyName) : keyName;
    const display = bestScale === 'Minor' ? `${displayKey}m` : displayKey;

    return { key: displayKey, scale: bestScale, display };
}

/**
 * Pearson correlation coefficient
 */
function correlate(a: Float64Array, b: number[]): number {
    const n = a.length;
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    for (let i = 0; i < n; i++) {
        sumA += a[i];
        sumB += b[i];
        sumAB += a[i] * b[i];
        sumA2 += a[i] * a[i];
        sumB2 += b[i] * b[i];
    }
    const num = n * sumAB - sumA * sumB;
    const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    return den === 0 ? 0 : num / den;
}

/**
 * Convert sharp notation to flat notation where conventional
 */
function toFlat(note: string): string {
    const map: Record<string, string> = {
        'C#': 'Db', 'D#': 'Eb', 'F#': 'F#', 'G#': 'Ab', 'A#': 'Bb'
    };
    return map[note] || note;
}

/**
 * Perform full audio analysis (BPM + Key) on an AudioBuffer.
 */
export async function analyzeAudio(buffer: AudioBuffer): Promise<AudioAnalysis> {
    const [bpm, keyResult] = await Promise.all([
        detectBPM(buffer),
        detectKey(buffer)
    ]);

    return {
        bpm,
        key: keyResult.key,
        scale: keyResult.scale,
        keyDisplay: keyResult.display
    };
}
