import React, { useCallback } from 'react';
import { useTimelineTracks } from '@/hooks/useTimelineTracks';

export const VideoUploader: React.FC = () => {
    const { addVideoTrack } = useTimelineTracks();

    const handleVideoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await addVideoTrack(file);
        event.target.value = '';
    }, [addVideoTrack]);

    return (
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h3 className="font-medium mb-2">🎬 Subir Video</h3>
            <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-500 mt-1">El video aparecerá como un canal más en el timeline</p>
        </div>
    );
};
