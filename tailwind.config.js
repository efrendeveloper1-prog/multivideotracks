/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
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
                }
            },
            animation: {
                'blur-in': 'blur-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-up': 'slide-up-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'zoom-in': 'zoom-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }
        },
    },
    plugins: [],
};
