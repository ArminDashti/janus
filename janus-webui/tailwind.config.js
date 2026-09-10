/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Consolas', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        // VS Code Dark+ surfaces
        surface: {
          app: '#1E1E1E',
          DEFAULT: '#252526',
          raised: '#2D2D30',
          border: '#3E3E42',
          input: '#3C3C3C'
        },
        accent: {
          DEFAULT: '#007ACC',
          hover: '#1177BB',
          muted: '#094771',
          fg: '#3794FF'
        },
        // Remap zinc scale toward Dark+ so existing classes pick up the theme
        zinc: {
          50: '#F3F3F3',
          100: '#E7E7E7',
          200: '#D4D4D4',
          300: '#CCCCCC',
          400: '#9D9D9D',
          500: '#858585',
          600: '#6A6A6A',
          700: '#3E3E42',
          800: '#2D2D30',
          900: '#252526',
          950: '#1E1E1E'
        },
        blue: {
          300: '#75BEFF',
          400: '#3794FF',
          500: '#0E639C',
          600: '#007ACC',
          700: '#005A9E'
        }
      }
    }
  },
  plugins: []
}
