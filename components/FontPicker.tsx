import React, { useState, useEffect } from 'react';
import { GOOGLE_FONTS, loadFont } from '@/utils/fonts';

interface FontPickerProps {
    onSelect: (font: string) => void;
    currentFont: string;
    onClose: () => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({ onSelect, currentFont, onClose }) => {
    const [search, setSearch] = useState('');
    const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

    const filteredFonts = GOOGLE_FONTS.filter(f => 
        f.toLowerCase().includes(search.toLowerCase())
    );

    // Initial load for current font
    useEffect(() => {
        if (currentFont) loadFont(currentFont);
    }, [currentFont]);

    // Load only visible fonts for preview
    useEffect(() => {
        const toLoad = filteredFonts.slice(0, 15);
        toLoad.forEach(f => {
            if (!loadedFonts.has(f)) {
                loadFont(f);
                setLoadedFonts(prev => new Set(prev).add(f));
            }
        });
    }, [filteredFonts, loadedFonts]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col h-[70vh] overflow-hidden">
                <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <span className="text-blue-400">🔤</span> Elegir Fuente
                    </h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-3 bg-gray-800/50">
                    <div className="relative">
                        <input 
                            autoFocus
                            type="text"
                            placeholder="Buscar fuente (ej: Montserrat, Pacifico...)"
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button 
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-1">
                        {filteredFonts.length > 0 ? (
                            filteredFonts.map((font) => (
                                <button
                                    key={font}
                                    onClick={() => onSelect(font)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left
                                        ${currentFont.includes(font) 
                                            ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300' 
                                            : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                                        }`}
                                >
                                    <span style={{ fontFamily: `'${font}', sans-serif` }} className="text-lg">
                                        {font}
                                    </span>
                                    {currentFont.includes(font) && (
                                        <span className="text-blue-500 text-xs font-bold uppercase">Actual</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500 italic">
                                No se encontraron fuentes con "{search}"
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="p-4 border-t border-gray-800 bg-gray-950 text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                    {filteredFonts.length} fuentes de Google Fonts
                </div>
            </div>
        </div>
    );
};
