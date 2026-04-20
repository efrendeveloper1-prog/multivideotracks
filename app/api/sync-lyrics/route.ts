import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Aumentar en caso de Vercel (Netlify lo ignora pero es bueno tenerlo)

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const mode = formData.get('mode') as string;
        const lyrics = formData.get('lyrics') as string;

        if (!audioFile) {
            return NextResponse.json({ success: false, error: "No audio file provided" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Convert file to base64 for inline submission to Gemini (Supports up to 20MB)
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

        console.log("Llamando a Gemini API para procesar audio...", mode);
        const result = await model.generateContent([promptText, generativePart]);
        const textResponse = result.response.text();

        // Limpiar posible formato markdown que envían los modelos (```json ... ```)
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const blocks = JSON.parse(cleanJson);

        return NextResponse.json({ success: true, blocks });

    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ success: false, error: error.message, raw: error }, { status: 500 });
    }
}
