'use client';

import { TwickStudio } from '@twick/studio';
import { StemUploader } from './StemUploader';
import { VideoUploader } from './VideoUploader';
import { SecondScreen } from './SecondScreen';
import '@twick/studio/dist/studio.css';

export default function StudioEditor() {
    return (
        <div className="flex h-screen">
            <div className="w-80 bg-gray-100 p-4 overflow-y-auto border-r">
                <h2 className="text-xl font-bold mb-4">🎛️ Multitrack Editor</h2>
                <StemUploader />
                <div className="my-4 border-t" />
                <VideoUploader />
                <div className="my-4 border-t" />
                <SecondScreen />
            </div>
            <div className="flex-1">
                <TwickStudio
                    studioConfig={{
                        videoProps: { width: 1280, height: 720 },
                    }}
                />
            </div>
        </div>
    );
}
