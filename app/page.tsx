import Link from 'next/link';

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
}
