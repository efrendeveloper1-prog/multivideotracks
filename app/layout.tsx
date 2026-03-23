import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: 'MultiVideoTracks Pro - Sincronización Profesional',
    description: 'Programa Experimental de libre uso para Cargar Multitracks de Audio y sincronizar Videosecuencia en vivo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=League+Spartan:wght@400;700&family=Montserrat:ital,wght@0,400;0,700;0,800;1,400&family=Poppins:wght@400;700;800&display=swap" rel="stylesheet" />
            </head>
            <body>{children}</body>
        </html>
    );
}
