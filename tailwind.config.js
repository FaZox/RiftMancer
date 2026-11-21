/** @type {import('tailwindcss').Config} */
// Design « Hextech » : bleu nuit + or, angles nets (biseautés via .hex-cut).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fonds (900 → 600) et textes (500 → 100), du plus sombre au plus clair.
        rift: {
          900: '#0a1220', // fond de l'app
          800: '#111c2e', // surfaces (cartes, barres)
          700: '#18263c', // surfaces en relief, champs
          600: '#2a3a55', // bordures
          500: '#8a93a6', // texte discret (≥ 4.5:1 sur le fond)
          400: '#a9b1c2', // texte secondaire
          300: '#c3c8d2',
          200: '#dcdcd6',
          100: '#ece6d6', // texte principal (blanc chaud)
        },
        gold: {
          600: '#a8893a',
          500: '#c8a84e', // boutons principaux
          400: '#e8c973', // texte doré, éléments actifs
          300: '#f3dc9a',
        },
        // State colours (AMELIORATIONS-APPLI.md B.1): never the only signal — always an icon or a word too.
        state: {
          ok: '#7fd6a4', // price up, success, « à jour »
          warn: '#f0c27a', // to confirm, estimated, update available
          bad: '#ff8a80', // price down, error, banned, delete
          info: '#8fb8e8', // neutral information, new
        },
        // Couleurs officielles des 6 domaines de Riftbound
        domain: {
          fury: '#e2463a',
          calm: '#3fb27f',
          mind: '#3a8fd9',
          body: '#e8863a',
          chaos: '#9b5de5',
          order: '#e3c04a',
          colorless: '#8a93a6',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        body: ['"Source Sans 3"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // Angles nets : le style Hextech remplace les grands arrondis.
      borderRadius: {
        sm: '1px',
        DEFAULT: '2px',
        md: '3px',
        lg: '3px',
        xl: '4px',
        '2xl': '6px',
        '3xl': '8px',
      },
    },
  },
  plugins: [],
};
