/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    safelist: [
        'animate-blur-in',
        'animate-slide-up',
        'animate-zoom-in',
        'animate-idle-float-pulse',
        'animate-shine-glitch',
        'animate-exit-down',
        'animate-zoom-in-slow',
        'animate-zoom-out-slow'
    ],
    theme: {
        extend: {
            keyframes: {
                'blur-in': {
                    '0%': { filter: 'blur(12px)', opacity: '0', transform: 'translateY(10px) scale(0.95)' },
                    '100%': { filter: 'blur(0)', opacity: '1', transform: 'translateY(0) scale(1)' }
                },
                'slide-up-fade': {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                'zoom-in': {
                    '0%': { opacity: '0', transform: 'scale(0.85)' },
                    '100%': { opacity: '1', transform: 'scale(1)' }
                },
                'float-pulse': {
                    '0%, 100%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-10px) scale(1.02)' }
                },
                'shine': {
                    '0%': { 'background-position': '-200% center' },
                    '20%, 100%': { 'background-position': '200% center' }
                },
                'glitch': {
                    '0%, 100%': { transform: 'translate(0)' },
                    '10%': { transform: 'translate(-2px, 1px)' },
                    '20%': { transform: 'translate(2px, -1px)' },
                    '30%': { transform: 'translate(-1px, 2px)' },
                    '31%, 90%': { transform: 'translate(0)' }
                },
                'exit-down': {
                    '0%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
                    '100%': { opacity: '0', transform: 'translateY(40px) scale(0.95)', filter: 'blur(4px)' }
                },
                'zoom-in-slow': {
                    '0%': { transform: 'scale(1)' },
                    '100%': { transform: 'scale(1.15)' }
                },
                'zoom-out-slow': {
                    '0%': { transform: 'scale(1)' },
                    '100%': { transform: 'scale(0.85)' }
                }
            },
            animation: {
                'blur-in': 'blur-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-up': 'slide-up-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'zoom-in': 'zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'idle-float-pulse': 'float-pulse 4s ease-in-out infinite',
                'shine-glitch': 'shine 6s linear infinite, glitch 8s step-end infinite',
                'exit-down': 'exit-down 0.4s cubic-bezier(0.32, 0, 0.67, 0) forwards',
                'zoom-in-slow': 'zoom-in-slow 15s ease-out forwards',
                'zoom-out-slow': 'zoom-out-slow 15s ease-out forwards'
            }
        },
    },

    plugins: [],
};
