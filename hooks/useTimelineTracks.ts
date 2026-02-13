import { useCallback } from 'react';
import { useTimeline } from '@twick/timeline';
import { getAudioDuration, getVideoDuration } from '@/utils/audio';

export const useTimelineTracks = () => {
    const { addTrack, removeTrack, updateTrack, getTracks } = useTimeline();

    const addAudioStem = useCallback(async (file: File, stemName: string) => {
        const url = URL.createObjectURL(file);
        const duration = await getAudioDuration(file);

        addTrack({
            id: `${stemName}-${Date.now()}`,
            name: stemName,
            type: 'audio',
            src: url,
            start: 0,
            duration,
            volume: 1,
            muted: false,
            trimStart: 0,
            trimEnd: duration,
        });
    }, [addTrack]);

    const addVideoTrack = useCallback(async (file: File) => {
        const url = URL.createObjectURL(file);
        const duration = await getVideoDuration(file);

        addTrack({
            id: `video-${Date.now()}`,
            name: file.name,
            type: 'video',
            src: url,
            start: 0,
            duration,
            volume: 1,
            muted: false,
            trimStart: 0,
            trimEnd: duration,
        });
    }, [addTrack]);

    return { addAudioStem, addVideoTrack, removeTrack, updateTrack, getTracks };
};
