import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-24 bg-zinc-950 text-white selection:bg-blue-500/30 overflow-hidden relative">
            <div className="z-10 w-full max-w-5xl items-center justify-center font-mono flex flex-col gap-6 sm:gap-8 text-center px-4 sm:px-0">
                <div className="relative flex place-items-center mb-2 sm:mb-8">
                    <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 flex items-center justify-center transition-all duration-300">
                        <Image
                            src="/logo.png"
                            alt="MultiVideoTracks Pro Logo"
                            width={320}
                            height={320}
                            className="object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)] w-full h-full p-2"
                            priority
                        />
                        <div className="absolute inset-0 bg-blue-500/5 blur-[40px] sm:blur-[60px] rounded-full animate-pulse -z-10" />
                    </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 pb-1 leading-tight sm:leading-normal">
                        MultiVideoTracks Pro
                    </h1>

                    <p className="text-base sm:text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light italic px-2">
                        "Programa Experimental de libre uso para Cargar Multitracks de Audio y sincronizar Videosecuencia en vivo"
                    </p>
                </div>

                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4 sm:px-0 z-20">
                    <Link
                        href="/studio"
                        className="group relative px-6 sm:px-12 py-3 sm:py-4 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 overflow-hidden w-full sm:w-auto text-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                        <span className="relative z-10 text-lg sm:text-xl">Abrir Estudio Profesional</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                </div>

                <div className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-zinc-900/50 w-full max-w-xs mx-auto">
                    <p className="text-zinc-500 text-xs sm:text-sm font-medium tracking-widest uppercase">
                        Powered by <span className="text-blue-400/80">Efrendeveloper</span>
                    </p>
                </div>
            </div>

            {/* Background decorative elements */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] sm:top-[-10%] left-[-20%] sm:left-[-10%] w-[80%] sm:w-[40%] h-[80%] sm:h-[40%] bg-blue-500/10 rounded-full blur-[80px] sm:blur-[120px]" />
                <div className="absolute bottom-[-20%] sm:bottom-[-10%] right-[-20%] sm:right-[-10%] w-[80%] sm:w-[40%] h-[80%] sm:h-[40%] bg-emerald-500/10 rounded-full blur-[80px] sm:blur-[120px]" />
            </div>
        </main>
    );
}
