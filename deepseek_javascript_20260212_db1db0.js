const fs = require('fs');
const path = require('path');

// Estructura de archivos: ruta => contenido
const files = {
  // App router
  'app/layout.tsx': `import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Moises Clone - Editor de Multitracks',
  description: 'Timeline profesional con soporte para stems, video y segunda pantalla',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}`,

  'app/page.tsx': `import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">🎵 Moises Clone</h1>
      <p className="text-xl mb-8">Editor de multitracks con timeline, stems, video y segunda pantalla</p>
      <Link href="/studio" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">
        Ir al Estudio
      </Link>
    </main>
  );
}`,

  'app/studio/page.tsx': `'use client';

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
}`,

  'app/presentation/page.tsx': `'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PresentationPage() {
  const searchParams = useSearchParams();
  const src = searchParams.get('src');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const connection = (navigator as any).presentation?.receiver?.connectionList;
    if (connection) {
      connection.then((list: any) => {
        list.connections.forEach((conn: any) => {
          conn.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === 'play' && videoRef.current) {
              videoRef.current.src = data.src;
              videoRef.current.currentTime = data.currentTime || 0;
              videoRef.current.play();
            }
          });
        });
      });
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <video ref={videoRef} controls autoPlay className="max-w-full max-h-full" />
    </div>
  );
}`,

  // Components
  'components/StudioEditor.tsx': `'use client';

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
}`,

  'components/StemUploader.tsx': `import React, { useCallback } from 'react';
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
      const fileEntry = contents.file(\`\${stem.key}.wav\`) || contents.file(\`\${stem.key}.mp3\`);
      if (fileEntry) {
        const blob = await fileEntry.async('blob');
        const audioFile = new File([blob], \`\${stem.key}.wav\`, { type: blob.type });
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
};`,

  'components/VideoUploader.tsx': `import React, { useCallback } from 'react';
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
};`,

  'components/SecondScreen.tsx': `import React, { useCallback, useEffect, useState } from 'react';
import { useTimeline } from '@twick/timeline';

export const SecondScreen: React.FC = () => {
  const { getTracks } = useTimeline();
  const [presentation, setPresentation] = useState<PresentationConnection | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'PresentationRequest' in window) {
      setAvailable(true);
    }
  }, []);

  const startPresentation = useCallback(async () => {
    const tracks = getTracks();
    const videoTrack = tracks.find(t => t.type === 'video');
    if (!videoTrack) {
      alert('No hay video cargado para mostrar en segunda pantalla');
      return;
    }

    try {
      const presentationUrl = \`/presentation?src=\${encodeURIComponent(videoTrack.src)}\`;
      const request = new (window as any).PresentationRequest(presentationUrl);
      const connection = await request.start();
      setPresentation(connection);

      connection.addEventListener('message', (event: MessageEvent) => {
        console.log('Mensaje desde presentación:', event.data);
      });

      connection.send(JSON.stringify({
        type: 'play',
        src: videoTrack.src,
        currentTime: 0,
      }));
    } catch (error) {
      console.error('Error al iniciar presentación:', error);
    }
  }, [getTracks]);

  const closePresentation = useCallback(() => {
    presentation?.close();
    setPresentation(null);
  }, [presentation]);

  if (!available) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-800 rounded">
        Tu navegador no soporta la API de segunda pantalla. Prueba con Chrome/Edge.
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-medium mb-2">🖥️ Segunda Pantalla</h3>
      <button
        onClick={startPresentation}
        disabled={!!presentation}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {presentation ? 'Presentación activa' : 'Enviar video a segunda pantalla'}
      </button>
      {presentation && (
        <button
          onClick={closePresentation}
          className="ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Cerrar
        </button>
      )}
    </div>
  );
};`,

  'components/AudioWaveform.tsx': `import React, { useRef, useEffect } from 'react';
import Waviz from 'waviz';

interface AudioWaveformProps {
  audioUrl: string;
  color?: string;
  height?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  color = '#3b82f6',
  height = 80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !audioRef.current) return;

    const waviz = new Waviz(canvasRef.current, audioRef.current);

    const handlePlay = async () => {
      await waviz.input.initializePending();
      waviz.visualizer.simpleBars(color);
    };

    const audio = audioRef.current;
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', () => waviz.visualizer.stop());

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', () => waviz.visualizer.stop());
    };
  }, [audioUrl, color]);

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={height} className="w-full" />
      <audio ref={audioRef} src={audioUrl} controls className="hidden" />
    </div>
  );
};`,

  // Hooks
  'hooks/useTimelineTracks.ts': `import { useCallback } from 'react';
import { useTimeline } from '@twick/timeline';
import { getAudioDuration, getVideoDuration } from '@/utils/audio';

export const useTimelineTracks = () => {
  const { addTrack, removeTrack, updateTrack, getTracks } = useTimeline();

  const addAudioStem = useCallback(async (file: File, stemName: string) => {
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);
    
    addTrack({
      id: \`\${stemName}-\${Date.now()}\`,
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
      id: \`video-\${Date.now()}\`,
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
};`,

  // Utils
  'utils/audio.ts': `export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', reject);
  });
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.addEventListener('loadedmetadata', () => resolve(video.duration));
    video.addEventListener('error', reject);
  });
}`,

  // Styles
  'styles/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,

  // Config files
  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`,

  'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,

  'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,

  'README.md': `# 🎵 Moises Clone - Editor de Multitracks

Proyecto Next.js + TypeScript + Tailwind CSS que simula un editor de audio/video profesional.

## 🚀 Características

- ✅ Subida de ZIP con pistas (batería, bajo, voz, piano)
- ✅ Subida de video como canal independiente
- ✅ Timeline interactivo (mover, cortar, ajustar)
- ✅ Segunda pantalla mediante Presentation API
- ✅ Visualización de formas de onda con waviz

## 📦 Instalación

\`\`\`bash
npm install
npm run dev
\`\`\`

## 🔑 Licencias

\`@twick/studio\` requiere licencia comercial. Durante desarrollo funciona con marca de agua.`,

  // package.json (simplificado, el usuario debe ejecutar npm install después)
  'package.json': `{
  "name": "moises-clone",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@twick/live-player": "latest",
    "@twick/studio": "latest",
    "@twick/timeline": "latest",
    "jszip": "^3.10.1",
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "waviz": "latest"
  },
  "devDependencies": {
    "@types/jszip": "^3.4.1",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}`
};

// Crear carpetas y archivos
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Creado: ${filePath}`);
});

console.log('\n🎉 Proyecto generado exitosamente!');
console.log('\nSiguientes pasos:');
console.log('1. Ejecuta: npm install');
console.log('2. Luego: npm run dev');
console.log('3. Abre http://localhost:3000');