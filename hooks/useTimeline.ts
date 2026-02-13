import { useTimelineContext, AudioElement, VideoElement } from '@twick/timeline';

// Interface matching the object passed in useTimelineTracks
interface TrackConfig {
    id: string; // Internal ID structure might differ, but we receive this
    name: string;
    type: 'audio' | 'video';
    src: string;
    start: number;
    duration: number;
    volume: number;
    muted: boolean;
    trimStart: number;
    trimEnd: number;
}

export const useTimeline = () => {
    const { editor, videoResolution } = useTimelineContext();

    const addTrack = async (config: TrackConfig) => {
        // Create track
        const track = editor.addTrack(config.name, config.type);

        // Create element based on type
        if (config.type === 'audio') {
            const element = new AudioElement(config.src);
            element.setStart(config.start);
            element.setEnd(config.start + config.duration);
            element.setName(config.name);
            element.setVolume(config.volume);
            // element.setStartAt(config.trimStart); // If supported

            await editor.addElementToTrack(track, element);
        } else if (config.type === 'video') {
            const element = new VideoElement(config.src, videoResolution || { width: 1920, height: 1080 });
            element.setStart(config.start);
            element.setEnd(config.start + config.duration);
            element.setName(config.name);
            element.setVolume(config.volume);
            // element.setStartAt(config.trimStart);

            await editor.addElementToTrack(track, element);
        }
    };

    const removeTrack = (id: string) => {
        editor.removeTrackById(id);
    };

    const updateTrack = (id: string, updates: any) => {
        // Placeholder implementation
        console.warn('updateTrack not fully implemented in adapter');
    };

    const getTracks = () => {
        return editor.getTimelineData()?.tracks || [];
    };

    const setTrackVolume = async (trackId: string, volume: number) => {
        const track = editor.getTrackById(trackId);
        if (!track) return;

        const elements = track.getElements();
        // Assuming single element per track for stems
        const element = elements[0];

        if (element && (element.getType() === 'audio' || element.getType() === 'video')) {
            // Cast to any to access setVolume as generic TrackElement doesn't have it in type definition explicitly here 
            // but AudioElement/VideoElement do.
            (element as any).setVolume(volume);
            editor.updateElement(element as any);
        }
    };

    return { addTrack, removeTrack, updateTrack, getTracks, setTrackVolume };
};
