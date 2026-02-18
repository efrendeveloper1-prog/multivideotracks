import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-zinc-950 text-white selection:bg-blue-500/30">
            <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex flex-col gap-8 text-center">
                <div className="relative flex place-items-center mb-8">
                    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="MultiVideoTracks Pro Logo"
                            width={320}
                            height={320}
                            className="object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                            priority
                        />
                        <div className="absolute inset-0 bg-blue-500/5 blur-[60px] rounded-full animate-pulse -z-10" />
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
                        className="group relative px-12 py-4 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 overflow-hidden"
                    >
                        <span className="relative z-10 text-xl">Abrir Estudio Profesional</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                </div>

                <div className="mt-16 pt-8 border-t border-zinc-900/50 w-full max-w-xs">
                    <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase">
                        Powered by <span className="text-blue-400/80">Efrendeveloper</span>
                    </p>
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
