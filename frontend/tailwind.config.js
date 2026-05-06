/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Primary – Deep Navy ─────────────────────────── */
        primary:                  '#000a1e',
        'primary-container':      '#002147',
        'on-primary':             '#ffffff',
        'on-primary-container':   '#708ab5',
        'primary-fixed':          '#d6e3ff',
        'primary-fixed-dim':      '#aec7f6',
        'inverse-primary':        '#aec7f6',

        /* ── Secondary – Amber / Gold ────────────────────── */
        secondary:                '#735c00',
        'secondary-container':    '#fed65b',
        'secondary-fixed':        '#ffe088',
        'secondary-fixed-dim':    '#e9c349',
        'on-secondary':           '#ffffff',
        'on-secondary-container': '#745c00',
        'on-secondary-fixed':     '#241a00',

        /* ── Tertiary – Deep Blue ────────────────────────── */
        tertiary:                   '#000b17',
        'tertiary-container':       '#00233a',
        'tertiary-fixed':           '#cde5ff',
        'tertiary-fixed-dim':       '#94ccff',
        'on-tertiary':              '#ffffff',
        'on-tertiary-container':    '#348fcf',
        'on-tertiary-fixed':        '#001d32',
        'on-tertiary-fixed-variant':'#004b74',

        /* ── Surface ─────────────────────────────────────── */
        surface:                    '#f8f9fa',
        'surface-dim':              '#d9dadb',
        'surface-bright':           '#f8f9fa',
        'surface-variant':          '#e1e3e4',
        'surface-tint':             '#465f88',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f3f4f5',
        'surface-container':        '#edeeef',
        'surface-container-high':   '#e7e8e9',
        'surface-container-highest':'#e1e3e4',

        /* ── On-Surface ──────────────────────────────────── */
        'on-surface':         '#191c1d',
        'on-surface-variant': '#44474e',
        'inverse-surface':    '#2e3132',
        'inverse-on-surface': '#f0f1f2',

        /* ── Outline ─────────────────────────────────────── */
        outline:         '#74777f',
        'outline-variant':'#c4c6cf',

        /* ── Error ───────────────────────────────────────── */
        error:               '#ba1a1a',
        'error-container':   '#ffdad6',
        'on-error':          '#ffffff',
        'on-error-container':'#93000a',

        /* ── Background ──────────────────────────────────── */
        background:    '#f8f9fa',
        'on-background':'#191c1d',
      },

      fontFamily: {
        headline: ['Manrope',  'ui-sans-serif', 'sans-serif'],
        body:     ['Inter',    'ui-sans-serif', 'sans-serif'],
        label:    ['Inter',    'ui-sans-serif', 'sans-serif'],
      },

      animation: {
        'progress':   'progress 1s ease-out forwards',
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        progress: {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--progress-width)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
