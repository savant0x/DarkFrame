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
        // Sci-Fi Glassmorphism Theme - Cyberpunk/Space Aesthetic
        // Neon accent colors
        neon: {
          cyan: '#00f0ff',
          blue: '#0080ff',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#10b981',
          yellow: '#fbbf24',
        },
        
        // Background colors - Deep space theme
        'bg-space': '#0a0e27',        // Deep space background
        'bg-void': '#050814',          // Darker void areas
        'bg-nebula': '#1a1f3a',       // Lighter nebula areas
        
        // Glass panel colors (with transparency)
        'glass-dark': 'rgba(15, 23, 42, 0.6)',     // Dark glass
        'glass-darker': 'rgba(10, 14, 39, 0.8)',   // Darker glass
        'glass-light': 'rgba(30, 41, 59, 0.5)',    // Light glass
        'glass-border': 'rgba(0, 240, 255, 0.2)',  // Cyan border glow
        
        // Text colors
        'text-primary': '#f1f5f9',     // Bright white for primary text
        'text-secondary': '#94a3b8',   // Muted gray for secondary
        'text-tertiary': '#64748b',    // Even more muted for tertiary
        'text-neon': '#00f0ff',        // Neon cyan for accents
        
        // Game-specific colors (updated for sci-fi theme)
        metal: '#94a3b8',
        energy: '#fbbf24',
        researchPoints: '#a855f7',
        health: '#ef4444',
        power: '#f59e0b',
        xp: '#0080ff',
        gold: '#fbbf24',
        territory: '#10b981',
        
        // Semantic colors with neon theme
        'success': '#10b981',
        'warning': '#fbbf24',
        'error': '#ef4444',
        'info': '#0080ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Monaco', 'Courier New', 'monospace'],
        display: ['Orbitron', 'Inter', 'sans-serif'], // Sci-fi display font
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.5), 0 0 40px rgba(0, 240, 255, 0.2)',
        'glow-cyan-sm': '0 0 10px rgba(0, 240, 255, 0.4)',
        'glow-blue': '0 0 20px rgba(0, 128, 255, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(0, 240, 255, 0.1)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
        'slide-up': 'slideUp 400ms ease-out',
        'slide-down': 'slideDown 400ms ease-out',
        'scale-in': 'scaleIn 300ms ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 240, 255, 0.8), 0 0 60px rgba(0, 240, 255, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
