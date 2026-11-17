/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14261E',
        leaf: { DEFAULT: '#1E6B4E', dark: '#154D39', soft: '#E3F0E9' },
        saffron: { DEFAULT: '#E9A820', soft: '#FBF0D4' },
        mist: '#F3F6F2',
        line: '#D9E2DA',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
