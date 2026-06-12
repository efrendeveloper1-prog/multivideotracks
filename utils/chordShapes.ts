/**
 * Chord shape data for guitar and piano visualizations.
 * Guitar: { strings: 6, frets: 5-fret window, fingering: per-string data }
 * Piano: list of MIDI semitones (0=C, 1=C#, ..., 11=B) relative to C4
 */

export type GuitarString = {
    fret: number | null; // null = muted (X), 0 = open
};

export interface GuitarChordShape {
    name: string;
    baseFret: number; // 1-indexed starting fret for the window (1 = standard position)
    strings: GuitarString[]; // 6 strings, index 0 = low E (string 6), index 5 = high e (string 1)
    barres?: { fret: number; fromString: number; toString: number }[]; // barre indicators
    fingers?: (number | null)[]; // finger numbers per string (1-4, null = muted/open)
}

export interface PianoChordShape {
    name: string;
    keys: number[]; // semitone offsets from root (0..11), relative to C octave
}

// ── Guitar chord library ───────────────────────────────────────────────────

export const GUITAR_CHORDS: Record<string, GuitarChordShape> = {
    // Major open chords
    C: { name: 'C', baseFret: 1, strings: [{ fret: null }, { fret: 3 }, { fret: 2 }, { fret: 0 }, { fret: 1 }, { fret: 0 }], fingers: [null, 3, 2, 0, 1, 0] },
    D: { name: 'D', baseFret: 1, strings: [{ fret: null }, { fret: null }, { fret: 0 }, { fret: 2 }, { fret: 3 }, { fret: 2 }], fingers: [null, null, 0, 1, 3, 2] },
    E: { name: 'E', baseFret: 1, strings: [{ fret: 0 }, { fret: 2 }, { fret: 2 }, { fret: 1 }, { fret: 0 }, { fret: 0 }], fingers: [0, 2, 3, 1, 0, 0] },
    F: { name: 'F', baseFret: 1, strings: [{ fret: 1 }, { fret: 1 }, { fret: 2 }, { fret: 3 }, { fret: 3 }, { fret: 1 }], barres: [{ fret: 1, fromString: 0, toString: 5 }], fingers: [1, 1, 2, 3, 4, 1] },
    G: { name: 'G', baseFret: 1, strings: [{ fret: 3 }, { fret: 2 }, { fret: 0 }, { fret: 0 }, { fret: 0 }, { fret: 3 }], fingers: [2, 1, 0, 0, 0, 3] },
    A: { name: 'A', baseFret: 1, strings: [{ fret: null }, { fret: 0 }, { fret: 2 }, { fret: 2 }, { fret: 2 }, { fret: 0 }], fingers: [null, 0, 1, 2, 3, 0] },
    B: { name: 'B', baseFret: 2, strings: [{ fret: null }, { fret: 2 }, { fret: 4 }, { fret: 4 }, { fret: 4 }, { fret: 2 }], barres: [{ fret: 2, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'C#': { name: 'C#', baseFret: 4, strings: [{ fret: null }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'Db': { name: 'Db', baseFret: 4, strings: [{ fret: null }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'D#': { name: 'D#', baseFret: 6, strings: [{ fret: null }, { fret: 6 }, { fret: 8 }, { fret: 8 }, { fret: 8 }, { fret: 6 }], barres: [{ fret: 6, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'Eb': { name: 'Eb', baseFret: 6, strings: [{ fret: null }, { fret: 6 }, { fret: 8 }, { fret: 8 }, { fret: 8 }, { fret: 6 }], barres: [{ fret: 6, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'F#': { name: 'F#', baseFret: 2, strings: [{ fret: 2 }, { fret: 2 }, { fret: 3 }, { fret: 4 }, { fret: 4 }, { fret: 2 }], barres: [{ fret: 2, fromString: 0, toString: 5 }], fingers: [1, 1, 2, 3, 4, 1] },
    'Gb': { name: 'Gb', baseFret: 2, strings: [{ fret: 2 }, { fret: 2 }, { fret: 3 }, { fret: 4 }, { fret: 4 }, { fret: 2 }], barres: [{ fret: 2, fromString: 0, toString: 5 }], fingers: [1, 1, 2, 3, 4, 1] },
    'G#': { name: 'G#', baseFret: 4, strings: [{ fret: 4 }, { fret: 4 }, { fret: 5 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 0, toString: 5 }], fingers: [1, 1, 2, 3, 4, 1] },
    'Ab': { name: 'Ab', baseFret: 4, strings: [{ fret: 4 }, { fret: 4 }, { fret: 5 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 0, toString: 5 }], fingers: [1, 1, 2, 3, 4, 1] },
    'A#': { name: 'A#', baseFret: 1, strings: [{ fret: null }, { fret: 1 }, { fret: 3 }, { fret: 3 }, { fret: 3 }, { fret: 1 }], barres: [{ fret: 1, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    'Bb': { name: 'Bb', baseFret: 1, strings: [{ fret: null }, { fret: 1 }, { fret: 3 }, { fret: 3 }, { fret: 3 }, { fret: 1 }], barres: [{ fret: 1, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 3, 3, 1] },
    // Minor chords
    Am: { name: 'Am', baseFret: 1, strings: [{ fret: null }, { fret: 0 }, { fret: 2 }, { fret: 2 }, { fret: 1 }, { fret: 0 }], fingers: [null, 0, 2, 3, 1, 0] },
    Bm: { name: 'Bm', baseFret: 2, strings: [{ fret: null }, { fret: 2 }, { fret: 4 }, { fret: 4 }, { fret: 3 }, { fret: 2 }], barres: [{ fret: 2, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    Cm: { name: 'Cm', baseFret: 3, strings: [{ fret: null }, { fret: 3 }, { fret: 5 }, { fret: 5 }, { fret: 4 }, { fret: 3 }], barres: [{ fret: 3, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    Dm: { name: 'Dm', baseFret: 1, strings: [{ fret: null }, { fret: null }, { fret: 0 }, { fret: 2 }, { fret: 3 }, { fret: 1 }], fingers: [null, null, 0, 2, 3, 1] },
    Em: { name: 'Em', baseFret: 1, strings: [{ fret: 0 }, { fret: 2 }, { fret: 2 }, { fret: 0 }, { fret: 0 }, { fret: 0 }], fingers: [0, 2, 3, 0, 0, 0] },
    Fm: { name: 'Fm', baseFret: 1, strings: [{ fret: 1 }, { fret: 1 }, { fret: 1 }, { fret: 3 }, { fret: 3 }, { fret: 1 }], barres: [{ fret: 1, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    Gm: { name: 'Gm', baseFret: 3, strings: [{ fret: 3 }, { fret: 3 }, { fret: 3 }, { fret: 5 }, { fret: 5 }, { fret: 3 }], barres: [{ fret: 3, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    'C#m': { name: 'C#m', baseFret: 4, strings: [{ fret: null }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 5 }, { fret: 4 }], barres: [{ fret: 4, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    'Dbm': { name: 'Dbm', baseFret: 4, strings: [{ fret: null }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 5 }, { fret: 4 }], barres: [{ fret: 4, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    'D#m': { name: 'D#m', baseFret: 6, strings: [{ fret: null }, { fret: 6 }, { fret: 8 }, { fret: 8 }, { fret: 7 }, { fret: 6 }], barres: [{ fret: 6, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    'Ebm': { name: 'Ebm', baseFret: 6, strings: [{ fret: null }, { fret: 6 }, { fret: 8 }, { fret: 8 }, { fret: 7 }, { fret: 6 }], barres: [{ fret: 6, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    'F#m': { name: 'F#m', baseFret: 2, strings: [{ fret: 2 }, { fret: 2 }, { fret: 2 }, { fret: 4 }, { fret: 4 }, { fret: 2 }], barres: [{ fret: 2, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    'Gbm': { name: 'Gbm', baseFret: 2, strings: [{ fret: 2 }, { fret: 2 }, { fret: 2 }, { fret: 4 }, { fret: 4 }, { fret: 2 }], barres: [{ fret: 2, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    'G#m': { name: 'G#m', baseFret: 4, strings: [{ fret: 4 }, { fret: 4 }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    'Abm': { name: 'Abm', baseFret: 4, strings: [{ fret: 4 }, { fret: 4 }, { fret: 4 }, { fret: 6 }, { fret: 6 }, { fret: 4 }], barres: [{ fret: 4, fromString: 0, toString: 5 }], fingers: [1, 1, 1, 3, 4, 1] },
    'A#m': { name: 'A#m', baseFret: 1, strings: [{ fret: null }, { fret: 1 }, { fret: 3 }, { fret: 3 }, { fret: 2 }, { fret: 1 }], barres: [{ fret: 1, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
    'Bbm': { name: 'Bbm', baseFret: 1, strings: [{ fret: null }, { fret: 1 }, { fret: 3 }, { fret: 3 }, { fret: 2 }, { fret: 1 }], barres: [{ fret: 1, fromString: 1, toString: 5 }], fingers: [null, 1, 3, 4, 2, 1] },
};

// ── Piano chord library ────────────────────────────────────────────────────

export const PIANO_CHORDS: Record<string, PianoChordShape> = {
    C:   { name: 'C',   keys: [0, 4, 7] },
    'C#': { name: 'C#', keys: [1, 5, 8] },
    'Db': { name: 'Db', keys: [1, 5, 8] },
    D:   { name: 'D',   keys: [2, 6, 9] },
    'D#': { name: 'D#', keys: [3, 7, 10] },
    'Eb': { name: 'Eb', keys: [3, 7, 10] },
    E:   { name: 'E',   keys: [4, 8, 11] },
    F:   { name: 'F',   keys: [5, 9, 0] },
    'F#': { name: 'F#', keys: [6, 10, 1] },
    'Gb': { name: 'Gb', keys: [6, 10, 1] },
    G:   { name: 'G',   keys: [7, 11, 2] },
    'G#': { name: 'G#', keys: [8, 0, 3] },
    'Ab': { name: 'Ab', keys: [8, 0, 3] },
    A:   { name: 'A',   keys: [9, 1, 4] },
    'A#': { name: 'A#', keys: [10, 2, 5] },
    'Bb': { name: 'Bb', keys: [10, 2, 5] },
    B:   { name: 'B',   keys: [11, 3, 6] },
    // Minor chords
    Am:  { name: 'Am',  keys: [9, 0, 4] },
    Bm:  { name: 'Bm',  keys: [11, 2, 6] },
    Cm:  { name: 'Cm',  keys: [0, 3, 7] },
    Dm:  { name: 'Dm',  keys: [2, 5, 9] },
    Em:  { name: 'Em',  keys: [4, 7, 11] },
    Fm:  { name: 'Fm',  keys: [5, 8, 0] },
    Gm:  { name: 'Gm',  keys: [7, 10, 2] },
    'C#m': { name: 'C#m', keys: [1, 4, 8] },
    'Dbm': { name: 'Dbm', keys: [1, 4, 8] },
    'D#m': { name: 'D#m', keys: [3, 6, 10] },
    'Ebm': { name: 'Ebm', keys: [3, 6, 10] },
    'F#m': { name: 'F#m', keys: [6, 9, 1] },
    'Gbm': { name: 'Gbm', keys: [6, 9, 1] },
    'G#m': { name: 'G#m', keys: [8, 11, 3] },
    'Abm': { name: 'Abm', keys: [8, 11, 3] },
    'A#m': { name: 'A#m', keys: [10, 1, 5] },
    'Bbm': { name: 'Bbm', keys: [10, 1, 5] },
};

// ── Chord progression generator ────────────────────────────────────────────

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

function noteAt(root: string, semitones: number): string {
    const rootIdx = CHROMATIC.indexOf(root);
    if (rootIdx === -1) return root;
    return CHROMATIC[(rootIdx + semitones) % 12];
}

// Roman numeral scale degrees → semitone offsets
// Major scale: I ii iii IV V vi vii°
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUALITIES = ['', 'm', 'm', '', '', 'm', 'm']; // major/minor (simplified, skip vii°)

// Natural minor scale: i ii° III iv v VI VII
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUALITIES = ['m', 'm', '', 'm', 'm', '', '']; // relative qualities

// Common progressions: indices into the scale degrees (0-based)
const MAJOR_PROGRESSIONS = [
    [0, 5, 3, 4],  // I – vi – IV – V
    [0, 3, 4, 0],  // I – IV – V – I
    [0, 4, 5, 3],  // I – V – vi – IV
    [0, 3, 0, 4],  // I – IV – I – V
    [0, 5, 1, 4],  // I – vi – ii – V
    [0, 2, 3, 4],  // I – iii – IV – V
];

const MINOR_PROGRESSIONS = [
    [0, 6, 3, 4],  // i – VII – iv – v
    [0, 5, 3, 4],  // i – VI – iv – v
    [0, 3, 4, 0],  // i – iv – v – i
    [0, 5, 6, 4],  // i – VI – VII – v
    [0, 2, 5, 4],  // i – III – VI – v (relative major feel)
];

export function generateChordProgression(keyDisplay: string): string[] {
    // Parse keyDisplay like "C Major", "F#m", "Bb Minor", "Am"
    if (!keyDisplay || keyDisplay === '--') return ['C', 'Am', 'F', 'G'];

    let root = '';
    let isMinor = false;

    const lower = keyDisplay.toLowerCase();
    if (lower.includes('minor') || lower.endsWith('m')) {
        isMinor = true;
    }

    // Extract root: first word or just the note
    const parts = keyDisplay.split(' ');
    root = parts[0];

    // Handle "F#m" form: strip trailing 'm'
    if (root.endsWith('m') && root.length > 1 && !root.endsWith('em') && !root.endsWith('am')) {
        // It's like "F#m"
        root = root.slice(0, -1);
        isMinor = true;
    }

    // Normalize flat aliases
    const flatAliases: Record<string, string> = {
        'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    const normalRoot = flatAliases[root] || root;

    const rootIdx = CHROMATIC.indexOf(normalRoot);
    if (rootIdx === -1) return ['C', 'Am', 'F', 'G']; // fallback

    const progressions = isMinor ? MINOR_PROGRESSIONS : MAJOR_PROGRESSIONS;
    const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
    const qualities = isMinor ? MINOR_QUALITIES : MAJOR_QUALITIES;

    // Pick a progression deterministically based on root
    const progIdx = rootIdx % progressions.length;
    const progression = progressions[progIdx];

    return progression.map(degree => {
        const semitones = intervals[degree];
        const noteSharp = noteAt(normalRoot, semitones);
        // Prefer flats for certain root keys
        const note = (root.includes('b') && FLAT_MAP[noteSharp]) ? FLAT_MAP[noteSharp] : noteSharp;
        const quality = qualities[degree];
        return `${note}${quality}`;
    });
}

export function transposeChord(chordName: string, semitones: number): string {
    if (semitones === 0) return chordName;
    
    // Separate root note from quality (e.g. C#m -> C#, m; C -> C, "")
    let root = '';
    let quality = '';
    
    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
        root = chordName.slice(0, 2);
        quality = chordName.slice(2);
    } else {
        root = chordName.slice(0, 1);
        quality = chordName.slice(1);
    }
    
    // Find index of root note
    let idx = CHROMATIC.indexOf(root);
    // If not found in CHROMATIC, check if it's a flat in FLAT_MAP
    if (idx === -1) {
        const sharpKey = Object.keys(FLAT_MAP).find(key => FLAT_MAP[key] === root);
        if (sharpKey) {
            idx = CHROMATIC.indexOf(sharpKey);
        }
    }
    
    if (idx === -1) return chordName; // fallback if invalid note
    
    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;
    
    let transposedRoot = CHROMATIC[newIdx];
    // If the original root had flat, or if we want to preserve flats, we can use FLAT_MAP
    if (root.includes('b') && FLAT_MAP[transposedRoot]) {
        transposedRoot = FLAT_MAP[transposedRoot];
    }
    
    return `${transposedRoot}${quality}`;
}

export function transposeKey(keyDisplay: string, semitones: number): string {
    if (!keyDisplay || keyDisplay === '--' || semitones === 0) return keyDisplay;
    
    // Find note root (e.g., C#, Db, C) and scale suffix
    const match = keyDisplay.match(/^([A-G]#?|[A-G]b?)(.*)$/);
    if (!match) return keyDisplay;
    
    const root = match[1];
    const suffix = match[2];
    
    let idx = CHROMATIC.indexOf(root);
    if (idx === -1) {
        const sharpKey = Object.keys(FLAT_MAP).find(key => FLAT_MAP[key] === root);
        if (sharpKey) {
            idx = CHROMATIC.indexOf(sharpKey);
        }
    }
    
    if (idx === -1) return keyDisplay;
    
    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;
    
    let transposedRoot = CHROMATIC[newIdx];
    if (root.includes('b') && FLAT_MAP[transposedRoot]) {
        transposedRoot = FLAT_MAP[transposedRoot];
    }
    
    return `${transposedRoot}${suffix}`;
}

export function getChordAtDegree(root: string, isMinor: boolean, degreeIndex: number): string {
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_MAP: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
    
    const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const qualities = isMinor ? ['m', 'm', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'm'];
    
    // Normalize root
    const flatAliases: Record<string, string> = {
        'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    const normalRoot = flatAliases[root] || root;
    
    // Find index of root note
    let rootIdx = CHROMATIC.indexOf(normalRoot);
    if (rootIdx === -1) return root; // fallback
    
    const semitones = intervals[degreeIndex % 7];
    const noteIdx = (rootIdx + semitones) % 12;
    const noteSharp = CHROMATIC[noteIdx];
    
    const note = (root.includes('b') && FLAT_MAP[noteSharp]) ? FLAT_MAP[noteSharp] : noteSharp;
    const quality = qualities[degreeIndex % 7];
    return `${note}${quality}`;
}

export function generateSectionProgression(keyDisplay: string, sectionLabel: string): string[] {
    if (!keyDisplay || keyDisplay === '--') return ['C', 'Am', 'F', 'G'];
    
    let root = '';
    let isMinor = false;

    const lowerKey = keyDisplay.toLowerCase();
    if (lowerKey.includes('minor') || lowerKey.endsWith('m')) {
        isMinor = true;
    }

    const parts = keyDisplay.split(' ');
    root = parts[0];
    if (root.endsWith('m') && root.length > 1 && !root.endsWith('em') && !root.endsWith('am')) {
        root = root.slice(0, -1);
        isMinor = true;
    }

    const label = (sectionLabel || '').toLowerCase();
    
    // Define progressions by degrees (0 = I/i, 1 = ii/ii°, 2 = iii/III, etc.)
    let degrees = [0, 5, 3, 4]; // fallback I - vi - IV - V (major) or i - VI - iv - v (minor)
    
    if (isMinor) {
        if (label.includes('coro') || label.includes('chorus') || label.includes('estribillo')) {
            degrees = [0, 5, 2, 6]; // i - VI - III - VII (Am - F - C - G)
        } else if (label.includes('verso') || label.includes('verse') || label.includes('estrofa')) {
            degrees = [0, 6, 5, 4]; // i - VII - VI - v (Am - G - F - Em)
        } else if (label.includes('intro') || label.includes('entrada') || label.includes('outro') || label.includes('final')) {
            degrees = [0, 5, 0, 5]; // i - VI - i - VI (Am - F - Am - F)
        } else if (label.includes('bridge') || label.includes('puente') || label.includes('solo') || label.includes('interludio') || label.includes('solo')) {
            degrees = [3, 4, 5, 6]; // iv - v - VI - VII (Dm - Em - F - G)
        }
    } else {
        if (label.includes('coro') || label.includes('chorus') || label.includes('estribillo')) {
            degrees = [0, 4, 5, 3]; // I - V - vi - IV (C - G - Am - F)
        } else if (label.includes('verso') || label.includes('verse') || label.includes('estrofa')) {
            degrees = [0, 5, 3, 4]; // I - vi - IV - V (C - Am - F - G)
        } else if (label.includes('intro') || label.includes('entrada') || label.includes('outro') || label.includes('final')) {
            degrees = [0, 3, 0, 3]; // I - IV - I - IV (C - F - C - F)
        } else if (label.includes('bridge') || label.includes('puente') || label.includes('solo') || label.includes('interludio') || label.includes('solo')) {
            degrees = [1, 4, 0, 5]; // ii - V - I - vi (Dm - G - C - Am)
        }
    }

    return degrees.map(degree => getChordAtDegree(root, isMinor, degree));
}


