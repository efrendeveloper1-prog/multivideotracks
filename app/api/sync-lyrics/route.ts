import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

// Lista de modelos a intentar en orden de preferencia (cascada de fallback)
const MODEL_FALLBACK_LIST = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
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
            promptText = `
Aquí tienes una pista de audio de una canción y sus letras oficiales:

LETRAS:
${lyrics}

Tu tarea es escuchar el audio y sincronizar las letras proporcionadas.
Devuélveme ÚNICAMENTE un array en formato puro JSON (sin etiquetas markdown como \`\`\`json). 
Cada objeto del array debe tener:
{
    "text": "línea o frase cantada",
    "startTime": 1.5, 
    "endTime": 3.0
}
Asegúrate de que los tiempos de inicio (startTime) y fin (endTime) estén en SEGUNDOS.
Alinea los tiempos basándote estrictamente en el audio de la voz.
No agregues texto extra antes o después del JSON.
`;
        } else {
            promptText = `
Aquí tienes una pista de audio (una pista de voz de una canción).
Tu tarea es escuchar el audio, transcribir la letra cantada y sincronizarla en el tiempo.
Devuélveme ÚNICAMENTE un array en formato puro JSON (sin etiquetas markdown como \`\`\`json). 
Cada objeto del array debe tener:
{
    "text": "línea o frase transcrita",
    "startTime": 1.5, 
    "endTime": 3.0
}
Asegúrate de que los tiempos de inicio (startTime) y fin (endTime) estén en SEGUNDOS.
Intenta agrupar el texto en frases lógicas (1 o 2 renglones).
No agregues texto extra antes o después del JSON.
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
