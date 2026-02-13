import React from 'react';

export const SongList: React.FC = () => {
    // Mock data for setlist
    const songs = [
        { id: 1, title: 'Living Hope', artist: 'Phil Wickham', key: 'Eb', bpm: 72, active: true },
        { id: 2, title: 'Do It Again', artist: 'Elevation Worship', key: 'Bb', bpm: 86, active: false },
        { id: 3, title: 'Prime Pads Vol 1', artist: 'Loop Community', key: 'C', bpm: 85, active: false },
        { id: 4, title: 'Freedom', artist: 'Bethel Music', key: 'Gb', bpm: 143, active: false },
        { id: 5, title: 'Lion and the Lamb', artist: 'Bethel Music', key: 'B', bpm: 90, active: false },
    ];

    return (
        <div className="w-full h-full bg-gray-800 flex flex-col">
            <div className="p-2 bg-green-500 text-white font-bold text-center uppercase tracking-wide">
                Setlist
            </div>
            <div className="flex-1 overflow-y-auto">
                {songs.map((song, index) => (
                    <div
                        key={song.id}
                        className={`p-3 border-b border-gray-700 flex items-center cursor-pointer transition-colors ${song.active ? 'bg-green-600/20 border-l-4 border-l-green-500' : 'hover:bg-gray-700'
                            }`}
                    >
                        <div className="w-6 text-sm font-bold text-gray-400">{index + 1})</div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-white text-sm font-bold truncate">{song.title}</div>
                            <div className="text-gray-400 text-xs truncate">by {song.artist}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                            <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-300">KEY: {song.key}</span>
                            <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-300">BPM: {song.bpm}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-2 bg-gray-700 border-t border-gray-600">
                <button className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold rounded uppercase">
                    + Add Song
                </button>
            </div>
        </div>
    );
};
