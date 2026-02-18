import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-zinc-950 text-white selection:bg-blue-500/30">
            <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex flex-col gap-8 text-center">
                <div className="relative flex place-items-center mb-8">
                    {/* Professional SVG Logo */}
                    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                            <defs>
                                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#38bdf8" />
                                    <stop offset="50%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                            </defs>
                            {/* Waveforms */}
                            <path d="M20,80 Q40,40 60,80 T100,80 T140,80 T180,80" fill="none" stroke="url(#waveGradient)" strokeWidth="4" className="animate-pulse opacity-40" />
                            <path d="M20,100 Q40,60 60,100 T100,100 T140,100 T180,100" fill="none" stroke="url(#waveGradient)" strokeWidth="6" strokeLinecap="round" />
                            <path d="M20,120 Q40,80 60,120 T100,120 T140,120 T180,120" fill="none" stroke="url(#waveGradient)" strokeWidth="4" className="animate-pulse opacity-40" />

                            {/* Play Button Shape Overlay */}
                            <path d="M70,60 L140,100 L70,140 Z" fill="rgba(0,0,0,0.3)" stroke="white" strokeWidth="2" />
                            <path d="M85,85 L115,100 L85,115 Z" fill="white" />
                        </svg>
                        <div className="absolute inset-0 bg-blue-500/10 blur-[60px] rounded-full animate-pulse" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">
                        MultiVideoTracks Pro
                    </h1>

                    <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light italic">
                        "Programa Experimental de libre uso para Cargar Multitracks de Audio y sincronizar Videosecuencia en vivo"
                    </p>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <Link
                        href="/studio"
                        className="group relative px-8 py-4 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 overflow-hidden"
                    >
                        <span className="relative z-10 text-lg">Abrir Estudio Profesional</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>

                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-8 py-4 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-medium rounded-full transition-all text-lg"
                    >
                        Ver Documentación
                    </a>
                </div>
            </div>

            {/* Background decorative elements */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
            </div>
        </main>
    );
}
