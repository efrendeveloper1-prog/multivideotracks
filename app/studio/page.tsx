'use client';

import { LivePlayerProvider } from '@twick/live-player';
import { TimelineProvider, INITIAL_TIMELINE_DATA } from '@twick/timeline';
import StudioEditor from '@/components/StudioEditor';

export default function StudioPage() {
    return (
        <LivePlayerProvider>
            <TimelineProvider initialData={INITIAL_TIMELINE_DATA} contextId="multitrack-editor">
                <StudioEditor />
            </TimelineProvider>
        </LivePlayerProvider>
    );
}
