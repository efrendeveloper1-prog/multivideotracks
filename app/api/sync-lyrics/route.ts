import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

// Modelos activos y comprobados con soporte para audio y generación de contenido
const MODEL_FALLBACK_LIST = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
];

function parseTimeString(val: any): number {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim().replace(/s$/i, "");
    if (str.includes(":")) {
        const parts = str.split(":");
        if (parts.length === 2) {
            return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
        } else if (parts.length === 3) {
            return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
        }
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function extractLyricBlocks(parsed: any): { text: string; startTime: number; endTime: number }[] {
    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
        rawList = parsed;
    } else if (parsed && typeof parsed === "object") {
        for (const key of ["blocks", "lyrics", "phrases", "transcription", "lines", "data", "segments", "results"]) {
            if (Array.isArray(parsed[key])) {
                rawList = parsed[key];
                break;
            }
        }
        if (rawList.length === 0) {
            const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
            if (firstArray && Array.isArray(firstArray)) {
                rawList = firstArray;
            }
        }
    }

    return rawList
        .map((item: any) => {
            const text = item.text || item.phrase || item.line || item.lyric || item.content || item.words || "";
            const startRaw = item.startTime ?? item.start ?? item.start_time ?? item.time ?? 0;
            const parsedStart = parseTimeString(startRaw);
            const endRaw = item.endTime ?? item.end ?? item.end_time ?? (parsedStart + 3.5);
            const parsedEnd = parseTimeString(endRaw);

            return {
                text: String(text).trim(),
                startTime: Number(parsedStart.toFixed(2)),
                endTime: Number(parsedEnd.toFixed(2)),
            };
        })
        .filter((b) => b.text.length > 0);
}

/**
 * Aplica anticipación visual a las marcas de tiempo para que la frase aparezca
 * en pantalla antes de que el cantante empiece a cantar, permitiendo leer con anticipación.
 * Protege contra solapamientos con la frase anterior.
 */
function applyReadingAnticipation(
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

async function tryGenerateWithFallback(
    genAI: GoogleGenerativeAI,
    promptText: string,
    generativePart: any
): Promise<{ text: string; modelUsed: string }> {
    let lastError: any = null;

    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Intentando con modelo: ${modelName}...`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                },
            });
            const result = await model.generateContent([promptText, generativePart]);
            const text = result.response.text();
            console.log(`✅ Éxito con modelo: ${modelName}`);
            return { text, modelUsed: modelName };
        } catch (err: any) {
            console.warn(`⚠️ Modelo ${modelName} falló (${err?.status || err?.message || "error"}), intentando siguiente...`);
            lastError = err;
            continue;
        }
    }

    throw new Error(
        `No fue posible sincronizar con Gemini. Último error: ${lastError?.message || "Cuota agotada o modelo no disponible"}. Por favor verifica tu API Key o intenta en unos minutos.`
    );
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;
        const mode = formData.get("mode") as string;
        const lyrics = formData.get("lyrics") as string;
        const leadTimeRaw = formData.get("leadTime");
        const leadTime = leadTimeRaw !== null ? parseFloat(leadTimeRaw as string) : 1.0;

        if (!audioFile) {
            return NextResponse.json({ success: false, error: "No se proporcionó ningún archivo de audio" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "GEMINI_API_KEY no está configurada en .env.local" }, { status: 500 });
        }

        console.log(`[AI Sync] Usando API Key iniciada en: ${apiKey.substring(0, 7)}...`);
        const genAI = new GoogleGenerativeAI(apiKey);

        // Convertir audio a base64
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");

        const generativePart = {
            inlineData: {
                data: base64Audio,
                mimeType: audioFile.type || "audio/wav",
            },
        };

        let promptText = "";
        if (mode === "align" && lyrics && lyrics.trim()) {
            promptText = `You are an expert audio-to-text music alignment engine.
TASK: Synchronize the provided OFFICIAL SONG LYRICS with the attached audio track.
Listen to the vocal track and find the exact timestamps when each line or phrase is sung.

OFFICIAL LYRICS:
${lyrics}

INSTRUCTIONS:
1. Match each phrase or line from the lyrics to the actual singing in the audio.
2. "startTime": exact second when the singer begins singing the phrase (decimal, e.g. 14.25).
3. "endTime": exact second when the singer finishes singing the phrase (decimal, e.g. 18.50).
4. If there is an instrumental intro or break, do not start at 0:00 unless the singing actually starts at 0:00.
5. Return ONLY a JSON array of objects with the structure:
[
  { "text": "Phrase line", "startTime": 12.3, "endTime": 15.8 }
]
`;
        } else {
            promptText = `You are a world-class vocal music transcription engine.
TASK: Listen carefully to the attached vocal audio track and transcribe ALL the sung lyrics into phrases with precise start and end times in seconds.

INSTRUCTIONS:
1. TRANSCRIBE: Transcribe all sung lyrics and vocalizations verbatim in their native language (Spanish, English, etc.).
2. PHRASING: Group words into natural 1 to 2 line song phrases (e.g. 4 to 10 words per phrase).
3. "startTime": The exact second when singing begins for that phrase (e.g. 15.4).
4. "endTime": The exact second when singing ends for that phrase (e.g. 19.8).
5. INSTRUMENTAL GAPS: Ignore instrumental intros, solos, and breaks. Only create blocks for when the singer is actively singing.
6. If the audio is purely instrumental or contains no intelligible singing, return an empty array [].
7. Return ONLY a JSON array of objects with the structure:
[
  { "text": "Transcribed phrase", "startTime": 15.4, "endTime": 19.8 }
]
`;
        }

        console.log(`[AI Sync] Iniciando en modo: ${mode}`);
        const { text: textResponse, modelUsed } = await tryGenerateWithFallback(genAI, promptText, generativePart);

        // Limpiar posibles bloques de código markdown
        let cleanText = textResponse.trim();
        if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```[a-z]*\r?\n/, "").replace(/\r?\n```$/, "").trim();
        }

        let parsedData: any = null;
        try {
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            const jsonMatch = cleanText.match(/\[[\s\S]*\]/) || cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedData = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error("Error al parsear JSON extraído:", e2);
                }
            }
        }

        if (!parsedData) {
            console.error("No se pudo obtener JSON válido de Gemini. Respuesta cruda:", cleanText.substring(0, 300));
            return NextResponse.json({
                success: false,
                error: "La IA no devolvió un formato JSON válido.",
                raw: cleanText.substring(0, 500),
            });
        }

        const rawBlocks = extractLyricBlocks(parsedData);
        // Aplicar anticipación visual para que el texto aparezca antes de cantar
        const blocks = applyReadingAnticipation(rawBlocks, isNaN(leadTime) ? 1.0 : leadTime);
        console.log(`[AI Sync] ✅ Completado con ${blocks.length} bloques (anticipación: ${leadTime}s) usando modelo: ${modelUsed}`);

        return NextResponse.json({ success: true, blocks, modelUsed, leadTimeApplied: leadTime });

    } catch (error: any) {
        console.error("❌ Error en /api/sync-lyrics:", error?.message || error);
        return NextResponse.json(
            { success: false, error: error.message || "Error desconocido en el servidor al sincronizar letras." },
            { status: 500 }
        );
    }
}
