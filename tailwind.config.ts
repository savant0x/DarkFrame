import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        synth: {
          void: '#02010A',
          shadow: '#0A0A14',
          card: '#111122',
          electric: '#007FFF',
          pink: '#FF1493',
          red: '#F73718',
          solar: '#FF4E00',
          green: '#00C853',
          yellow: '#C8D600',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'Monaco', 'monospace'],
        display: ['Orbitron', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-electric': '0 0 10px rgba(0,127,255,0.15), 0 0 3px rgba(0,127,255,0.08)',
        'glow-pink': '0 0 10px rgba(255,20,147,0.15), 0 0 3px rgba(255,20,147,0.08)',
        'glow-red': '0 0 10px rgba(247,55,24,0.15), 0 0 3px rgba(247,55,24,0.08)',
        'glow-synth': '0 0 10px rgba(0,230,118,0.12), 0 0 3px rgba(0,230,118,0.06)',
        'glow-solar': '0 0 10px rgba(255,78,0,0.12), 0 0 3px rgba(255,78,0,0.06)',
      },
    },
  },
  plugins: [],
};
export default config;