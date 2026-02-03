import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Professional Semantic Palette
        brand: {
          primary: '#6366F1',    // Indigo - Primary brand color
          secondary: '#EC4899',  // Pink - Secondary accents
          success: '#10B981',    // Emerald - Success states
          destructive: '#EF4444', // Rose - Destructive actions
        },
        
        // Light Theme - "Frosted Workspace"
        light: {
          bg: '#F8FAFC',         // Slate 50 - Background
          surface: 'rgba(255, 255, 255, 0.7)', // Glass surface
          border: 'rgba(226, 232, 240, 0.8)',  // Slate 200 border
          text: {
            primary: '#0F172A',  // Slate 900 - Primary text
            muted: '#64748B',    // Slate 500 - Muted text
          }
        },
        
        // Dark Theme - "Midnight Nebula"
        dark: {
          bg: '#020617',         // Slate 950 - Deep navy background
          surface: 'rgba(15, 23, 42, 0.6)', // Glass surface
          border: 'rgba(30, 41, 59, 0.5)',  // Slate 800 border
          text: {
            primary: '#F8FAFC',  // Slate 50 - Off-white text
            muted: '#94A3B8',    // Slate 400 - Muted text
          },
          glow: 'rgba(99, 102, 241, 0.15)', // Indigo glow
        },
      },
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.4)',
        // Enhanced Shadow System from CTO Guide
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'shimmer': 'shimmer 2s infinite',
        'fadeInUp': 'fadeInUp 0.5s ease-out forwards',
        'scaleIn': 'scaleIn 0.3s ease-out forwards',
        'gradient': 'gradient 3s ease infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backgroundSize: {
        'gradient': '200% 200%',
      },
      scale: {
        '102': '1.02',
      },
      backdropBlur: {
        'xs': '2px',
        '2xl': '40px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;