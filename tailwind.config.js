/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#14206B',
        ink: '#0C1330',
        red: '#D62828',
        gold: '#F5B800',
        mist: '#E8F1FB',
        sky: '#CFE3F7',
        paper: '#FFFFFF',
        grey: '#5A6383',
        line: '#D9E3F1',
        'success': '#1FA855',
        'success-bg': '#E6F7EC',
        'notice-bg': '#FFF6D6',
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", 'system-ui', 'sans-serif'],
        body: ["'Figtree'", 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '26px',
        full: '999px',
      },
      boxShadow: {
        gold: 'inset 0 -6px 0 var(--tw-colors-gold)',
      },
    },
  },
  plugins: [],
}
