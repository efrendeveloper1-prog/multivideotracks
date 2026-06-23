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
    timeSignature?: string; // e.g. "4/4", "3/4"
}

/**
 * Detect BPM from an AudioBuffer using web-audio-beat-detector.
 */
async function detectBPM(buffer: AudioBuffer): Promise<number> {
    try {
        console.log(`Analyzing BPM on buffer: duration ${buffer.duration}s`);
        // For best results, use a 20-second segment where the beat is established
        // First choice: starting at 30 seconds
        const startOffset = buffer.duration > 50 ? 30 : 0;
        const analyzeDuration = Math.min(20, buffer.duration - startOffset);
        
        console.log(`BPM detection primary attempt: offset ${startOffset}s, duration ${analyzeDuration}s`);
        const result = await guess(buffer, startOffset, analyzeDuration);
        console.log(`BPM guess primary result:`, result);
        if (result.bpm && result.bpm > 0) {
            return Math.round(result.bpm);
        }
    } catch (e) {
        console.warn('BPM primary attempt failed, trying fallback 1 (first 20 seconds):', e);
    }

    // Fallback 1: analyze first 20 seconds
    try {
        const analyzeDuration = Math.min(20, buffer.duration);
        const result = await guess(buffer, 0, analyzeDuration);
        console.log(`BPM guess fallback 1 result:`, result);
        if (result.bpm && result.bpm > 0) {
            return Math.round(result.bpm);
        }
    } catch (e) {
        console.warn('BPM fallback 1 failed, trying fallback 2 (midpoint of song):', e);
    }

    // Fallback 2: analyze a 20-second segment in the middle of the song
    try {
        if (buffer.duration > 40) {
            const startOffset = Math.floor(buffer.duration / 2) - 10;
            const result = await guess(buffer, startOffset, 20);
            console.log(`BPM guess fallback 2 result:`, result);
            if (result.bpm && result.bpm > 0) {
                return Math.round(result.bpm);
            }
        }
    } catch (e) {
        console.error('BPM fallback 2 failed:', e);
    }

    return 0;
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
    const maxChroma = chromagram.reduce((acc, v) => (v > acc ? v : acc), 0);
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
 * Heuristic to detect time signature (e.g. 4/4 vs 3/4) by analyzing 
 * the onset autocorrelation at lags of 3 and 4 beats.
 */
function detectTimeSignature(buffer: AudioBuffer, bpm: number): string {
    if (bpm <= 0) return "4/4"; // Fallback

    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);
    const chunkSize = Math.floor(sampleRate / 100); // 10ms resolution
    const numChunks = Math.floor(channelData.length / chunkSize);
    
    // Analyze up to 45 seconds to get a good read
    const maxChunks = Math.min(numChunks, 4500); 
    const envelope = new Float32Array(maxChunks);
    
    for (let i = 0; i < maxChunks; i++) {
        let sum = 0;
        const start = i * chunkSize;
        for (let j = 0; j < chunkSize; j++) {
            const v = channelData[start + j];
            sum += v * v;
        }
        envelope[i] = Math.sqrt(sum / chunkSize);
    }
    
    // Create an onset track (positive energy differences)
    const onset = new Float32Array(maxChunks);
    for (let i = 1; i < maxChunks; i++) {
        onset[i] = Math.max(0, envelope[i] - envelope[i - 1]);
    }
    
    const beatDurationSecs = 60 / bpm;
    const beatLagChunks = Math.round(beatDurationSecs * 100);
    
    const lag3 = beatLagChunks * 3;
    const lag4 = beatLagChunks * 4;
    
    // Autocorrelation function for the onset track with a small window search
    const computeOnsetAutocorr = (baseLag: number) => {
        let bestCorr = 0;
        // Search a small window around the lag to account for BPM drift and sharp transient misalignment
        for (let offset = -2; offset <= 2; offset++) {
            const lag = baseLag + offset;
            if (lag >= maxChunks || lag <= 0) continue;
            let p = 0;
            for(let i = 0; i < maxChunks - lag; i++) {
                p += onset[i] * onset[i + lag];
            }
            const corr = p / (maxChunks - lag);
            if (corr > bestCorr) bestCorr = corr;
        }
        return bestCorr;
    };
    
    const corr3 = computeOnsetAutocorr(lag3);
    const corr4 = computeOnsetAutocorr(lag4);
    
    // Compare structural strength of downbeats every 3 vs 4 beats
    // Default to 4/4 since it's the most common in modern music, 
    // unless 3/4 is significantly stronger.
    if (corr3 > corr4 * 1.4) {
        return "3/4";
    }
    return "4/4";
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

function detectBpmFromPeaks(buffer: AudioBuffer): number {
    try {
        const data = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        
        // Find absolute maximum peak amplitude
        let maxVal = 0;
        for (let i = 0; i < data.length; i++) {
            const val = Math.abs(data[i]);
            if (val > maxVal) maxVal = val;
        }
        
        if (maxVal < 0.01) return 0; // Quiet buffer
        
        // Set threshold at 30% of maximum amplitude
        const threshold = maxVal * 0.3;
        const minDistanceSamples = Math.round(sampleRate * 0.22); // ~220ms minimum distance (max ~270 BPM)
        
        const peakIndices: number[] = [];
        let lastPeakIndex = -minDistanceSamples;
        
        for (let i = 0; i < data.length; i++) {
            const val = Math.abs(data[i]);
            if (val > threshold && (i - lastPeakIndex) > minDistanceSamples) {
                peakIndices.push(i);
                lastPeakIndex = i;
            }
        }
        
        if (peakIndices.length < 8) return 0; // Too few peaks
        
        // Calculate differences (intervals) between peaks in seconds
        const intervals: number[] = [];
        for (let i = 1; i < peakIndices.length; i++) {
            intervals.push((peakIndices[i] - peakIndices[i - 1]) / sampleRate);
        }
        
        // Group intervals to find the most common interval (tempo)
        // Round to 2 decimal places to group intervals in 10ms bins
        const bins: Record<string, number[]> = {};
        intervals.forEach(interval => {
            const rounded = interval.toFixed(2);
            if (!bins[rounded]) bins[rounded] = [];
            bins[rounded].push(interval);
        });
        
        // Find the bin with the highest count
        let bestBinKey = "";
        let maxCount = 0;
        for (const binKey in bins) {
            if (bins[binKey].length > maxCount) {
                maxCount = bins[binKey].length;
                bestBinKey = binKey;
            }
        }
        
        if (!bestBinKey) return 0;
        
        // Confidence check: the most common interval must occur in at least 25% of intervals
        if (maxCount < intervals.length * 0.25) {
            console.log(`Peak detection confidence low (${maxCount}/${intervals.length} intervals), falling back.`);
            return 0;
        }
        
        // Calculate the exact average interval within the modal bin to avoid 1-2 BPM quantization rounding errors
        const matchingIntervals = bins[bestBinKey];
        const sumIntervals = matchingIntervals.reduce((sum, val) => sum + val, 0);
        const targetInterval = sumIntervals / matchingIntervals.length;
        
        if (!targetInterval || targetInterval <= 0) return 0;
        
        // Calculate BPM
        const bpm = 60 / targetInterval;
        
        // Validate range (45 to 220 BPM)
        if (bpm >= 45 && bpm <= 220) {
            return Math.round(bpm);
        }
    } catch (e) {
        console.error("Error in peak BPM detection:", e);
    }
    return 0;
}

export async function analyzeAudio(buffer: AudioBuffer, rhythmBuffer?: AudioBuffer): Promise<AudioAnalysis> {
    const rBuffer = rhythmBuffer || buffer;
    
    // Try custom peak detection first (extremely precise on click/rhythm tracks)
    let bpm = detectBpmFromPeaks(rBuffer);
    console.log(`BPM from custom peak detection:`, bpm);
    
    const keyResult = await detectKey(buffer);
    
    if (bpm <= 0) {
        // Fallback to web-audio-beat-detector if custom peak detection fails
        bpm = await detectBPM(rBuffer);
        console.log(`BPM from web-audio-beat-detector fallback:`, bpm);
    }
    
    // If still 0, default to 120
    if (bpm <= 0) {
        bpm = 120;
    }

    const timeSignature = detectTimeSignature(rBuffer, bpm);

    return {
        bpm,
        key: keyResult.key,
        scale: keyResult.scale,
        keyDisplay: keyResult.display,
        timeSignature
    };
}
