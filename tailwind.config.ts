import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9', // Enterprise Sky Blue
          700: '#0369a1',
          900: '#0c4a6e',
        },
      },
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;