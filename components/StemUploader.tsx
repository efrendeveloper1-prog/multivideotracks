import React, { useCallback } from 'react';
import JSZip from 'jszip';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export const StemUploader: React.FC = () => {
    const { addTrack } = useAudioEngine();

    const handleZipUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);

            // Iterate through all files in the zip
            const filePromises: Promise<void>[] = [];

            contents.forEach((relativePath, fileEntry) => {
                if (fileEntry.dir) return; // Skip directories

                // Check extensions (wav, mp3)
                if (relativePath.match(/\.(wav|mp3)$/i)) {
                    const promise = async () => {
                        const blob = await fileEntry.async('blob');
                        // Use filename without extension as track name
                        const trackName = relativePath.split('/').pop()?.replace(/\.(wav|mp3)$/i, '') || 'Track';
                        // Create a File object
                        const audioFile = new File([blob], relativePath, { type: blob.type || 'audio/mpeg' });
                        await addTrack(audioFile, trackName);
                    };
                    filePromises.push(promise());
                }
            });

            await Promise.all(filePromises);
            alert('Stems cargados correctamente!');
        } catch (error) {
            console.error('Error al procesar el ZIP:', error);
            alert('Error al leer el archivo ZIP.');
        }

        event.target.value = '';
    }, [addTrack]);

    return (
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h3 className="font-medium mb-2">📦 Subir Multitrack (ZIP)</h3>
            <input
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
                Sube un ZIP con tus archivos de audio (.mp3, .wav). Se cargarán automáticamente.
            </p>
        </div>
    );
};
