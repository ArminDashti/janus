/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        surface: {
          DEFAULT: '#18181b',
          raised: '#27272a',
          border: '#3f3f46'
        }
      }
    }
  },
  plugins: []
}
