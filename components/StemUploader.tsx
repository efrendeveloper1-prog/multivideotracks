import React, { useCallback } from 'react';
import JSZip from 'jszip';
import { useTimelineTracks } from '@/hooks/useTimelineTracks';

export const StemUploader: React.FC = () => {
    const { addAudioStem } = useTimelineTracks();

    const handleZipUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        const stemFiles = [
            { key: 'drums', name: 'Batería' },
            { key: 'bass', name: 'Bajo' },
            { key: 'vocals', name: 'Voz' },
            { key: 'piano', name: 'Piano' },
        ];

        for (const stem of stemFiles) {
            const fileEntry = contents.file(`${stem.key}.wav`) || contents.file(`${stem.key}.mp3`);
            if (fileEntry) {
                const blob = await fileEntry.async('blob');
                const audioFile = new File([blob], `${stem.key}.wav`, { type: blob.type });
                await addAudioStem(audioFile, stem.name);
            }
        }

        event.target.value = '';
    }, [addAudioStem]);

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
                El ZIP debe contener: drums.wav, bass.wav, vocals.wav, piano.wav (o .mp3)
            </p>
        </div>
    );
};
