import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

// Lista de modelos a intentar en orden de preferencia (cascada de fallback)
// Priorizamos modelos más capaces (mejor reconocimiento de voz) antes que los lite
const MODEL_FALLBACK_LIST = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
];

async function tryGenerateWithFallback(
    genAI: GoogleGenerativeAI,
    promptText: string,
    generativePart: any
): Promise<{ text: string; modelUsed: string }> {
    let lastError: any = null;

    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Intentando con modelo: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([promptText, generativePart]);
            const text = result.response.text();
            console.log(`✅ Éxito con modelo: ${modelName}`);
            return { text, modelUsed: modelName };
        } catch (err: any) {
            const status = err?.status;
            const isQuota = status === 429 || (err?.message || "").includes("quota");
            const isNotFound = status === 404;

            if (isQuota || isNotFound) {
                console.warn(`⚠️ Modelo ${modelName} falló (${status || "error"}), intentando siguiente...`);
                lastError = err;
                continue;
            }

            // Si el error no es de cuota o 404, lo lanzamos de inmediato
            throw err;
        }
    }

    // Si todos los modelos fallaron
    throw new Error(
        `Todos los modelos de Gemini agotaron su cuota o no están disponibles. Último error: ${lastError?.message}. Por favor espera unos minutos y vuelve a intentarlo.`
    );
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;
        const mode = formData.get("mode") as string;
        const lyrics = formData.get("lyrics") as string;

        if (!audioFile) {
            return NextResponse.json({ success: false, error: "No audio file provided" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "GEMINI_API_KEY no está configurada en el servidor." }, { status: 500 });
        }

        console.log(`Usando API Key que empieza por: ${apiKey.substring(0, 7)}...`);
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
            promptText = `You are a professional audio-to-text synchronization specialist. Your goal is EXTREME temporal precision and word-for-word alignment.

TASK: Synchronize the provided OFFICIAL LYRICS with the attached vocal audio track.

OFFICIAL LYRICS:
${lyrics}

STRICT ARCHITECTURAL RULES:
1. Listen critically to the vocal transients. The "startTime" must be the millisecond the singer starts the first phoneme of the phrase.
2. The "endTime" must be the EXACT moment the vocal resonance of the last word fades out.
3. GAP DETECTION: If there is more than 0.5 seconds of silence or instrumental-only audio between phrases, the previous "endTime" MUST NOT touch the next "startTime". There should be a visible gap in the timestamps.
4. VERBATIM: If the singer deviates slightly from the official lyrics, prioritize what is actually SUNG in the "text" field, or at least align the timestamps to the singing.
5. NO LAZINESS: Do not round to the nearest second. Use 0.1s precision (e.g. 14.7).
6. FORMAT: Return ONLY a raw JSON array. Example: [{"text": "Hello world", "startTime": 1.2, "endTime": 3.4}]. No markdown.
`;
        } else {
            promptText = `You are a world-class music transcription engine. Your goal is a 100% accurate verbatim transcript with precise timing.

TASK: Transcribe the attached vocal audio track and determine the exact start and end times for each phrase.

STRICT TRANSCRIBER RULES:
1. WORD ACCURACY: Transcribe exactly what is sung. Do not guess or autocorrect if the singer uses slang or specific উচ্চারন (pronunciation).
2. LANGUAGE: Detect the language automatically and transcribe in its native script.
3. PHRASING: Group into 1-2 line logical song phrases.
4. TIMING PRECISION: 
   - "startTime": EXACT start of vocalization.
   - "endTime": EXACT moment the voice stops/fades.
5. GAP HANDLING: If there is a break in singing (instrumental, breath, pause > 0.4s), the "endTime" of the previous phrase MUST reflect the actual stop. DO NOT carry the text over musical gaps.
6. BACKGROUND NOISE: Ignore any residual background music or noise. Focus only on the leading vocal.
7. FORMAT: Return ONLY a raw JSON array. Example: [{"text": "Phrase text", "startTime": 10.5, "endTime": 13.2}]. No markdown.
`;
        }

        console.log(`Iniciando sincronización AI en modo: ${mode}`);
        const { text: textResponse, modelUsed } = await tryGenerateWithFallback(genAI, promptText, generativePart);

        // Extraer el JSON del array de la respuesta
        const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error("No se encontró un array JSON en la respuesta de Gemini. Respuesta recibida:", textResponse.substring(0, 300));
            return NextResponse.json({ success: false, error: "La IA no devolvió un formato válido.", raw: textResponse });
        }

        const blocks = JSON.parse(jsonMatch[0]);
        console.log(`✅ Sincronización completada con ${blocks.length} bloques usando ${modelUsed}`);

        return NextResponse.json({ success: true, blocks, modelUsed });

    } catch (error: any) {
        console.error("❌ Error final en AI Sync:", error?.message || error);
        return NextResponse.json(
            { success: false, error: error.message || "Error desconocido en el servidor." },
            { status: 500 }
        );
    }
}
