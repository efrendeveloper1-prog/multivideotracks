import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: 'MultiVideoTracks Pro - Sincronización Profesional',
    description: 'Programa Experimental de libre uso para Cargar Multitracks de Audio y sincronizar Videosecuencia en vivo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body>{children}</body>
        </html>
    );
}
