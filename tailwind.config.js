/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        studio: {
          bg: '#EEF1F5',
          panel: '#FFFFFF',
          border: '#D9E0E8',
          ink: '#0F172A',
          muted: '#526072',
          accent: '#EA580C',
          blueprint: '#1D4ED8',
        },
      },
    },
  },
  plugins: [],
};
