/** @type {import('tailwindcss').Config} */
// Theme tokens. Refreshed Gartic.io-inspired palette: deep violet
// background, bright accent colors, glassy translucent surfaces.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep violet base, layered above the radial gradient set in
        // theme.css. `surface` is a translucent off-white the cards lay
        // on top of (frosted-glass look).
        bg: '#0e0728',
        'bg-deep': '#070114',
        surface: 'rgba(255, 255, 255, 0.06)',
        'surface-strong': 'rgba(255, 255, 255, 0.10)',
        // Accent palette — saturated, friendly, slightly pop-art.
        purple: '#a855f7',
        'purple-bright': '#c084fc',
        pink: '#ec4899',
        'pink-bright': '#f472b6',
        yellow: '#fde047',
        'yellow-bright': '#facc15',
        cyan: '#22d3ee',
        'cyan-bright': '#67e8f9',
        green: '#4ade80',
        'green-bright': '#86efac',
        red: '#fb7185',
        // legacy alias used by existing components
        blue: '#22d3ee',
      },
      fontFamily: {
        sans: [
          'Poppins',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          '"Rubik Spray Paint"',
          'cursive',
          'system-ui',
        ],
      },
      boxShadow: {
        // Hard shadow that gives the chunky / cartoon feel — used for
        // primary CTA buttons and hero cards.
        chunky: '0 6px 0 0 rgba(0, 0, 0, 0.45)',
        'chunky-sm': '0 3px 0 0 rgba(0, 0, 0, 0.45)',
        glow: '0 0 30px rgba(168, 85, 247, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 2.5s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};
