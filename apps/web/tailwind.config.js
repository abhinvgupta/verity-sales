/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pale green-tinted ground for "the reading" surfaces
        porcelain: '#F3F5F2',
        // Spruce ink — "the record" surfaces (transcripts, evidence)
        ink: {
          50: '#EDF2F0',
          100: '#DCE6E2',
          200: '#BFD2CB',
          300: '#9BB6AD',
          400: '#6E9287',
          500: '#4B6F65',
          600: '#33544B',
          700: '#24423A',
          800: '#18302B',
          900: '#10221E',
          950: '#0A1815',
        },
        // Malachite — brand / primary actions
        verity: {
          100: '#D7F0E5',
          200: '#ACE0CC',
          300: '#79C9AC',
          400: '#41AC87',
          500: '#188F69',
          600: '#0E7455',
          700: '#0C5B44',
        },
        // Functional verdict colors for comparison findings
        verdict: {
          match: '#188F4E',
          partial: '#A8650B',
          mismatch: '#C12F49',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Spline Sans Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        wavebar: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        wavebar: 'wavebar 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
