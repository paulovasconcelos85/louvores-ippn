/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Estilo de impresso reformado do séc. XVI em todo o sistema.
        sans: ['var(--font-garamond)', 'Garamond', 'Georgia', 'serif'],
        garamond: ['var(--font-garamond)', 'Garamond', 'Georgia', 'serif'],
        fell: ['var(--font-fell)', 'var(--font-garamond)', 'Georgia', 'serif'],
      },
      // Garamond tem olho pequeno; os tamanhos sobem um pouco para manter a leitura.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.9375rem', { lineHeight: '1.35rem' }],
        base: ['1.0625rem', { lineHeight: '1.65rem' }],
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],
      },
      // Cartões mais próximos de folhas impressas; botões rounded-full continuam pílulas.
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
      // Sombras em tom de tinta, não de preto puro.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(30 18 8 / 0.06)',
        DEFAULT: '0 1px 3px 0 rgb(30 18 8 / 0.08), 0 1px 2px -1px rgb(30 18 8 / 0.06)',
        md: '0 4px 10px -2px rgb(30 18 8 / 0.08), 0 2px 4px -2px rgb(30 18 8 / 0.05)',
        lg: '0 14px 28px -12px rgb(30 18 8 / 0.18), 0 4px 8px -4px rgb(30 18 8 / 0.06)',
        xl: '0 20px 44px -20px rgb(30 18 8 / 0.28), 0 8px 12px -6px rgb(30 18 8 / 0.06)',
        '2xl': '0 28px 60px -24px rgb(30 18 8 / 0.38)',
      },
      colors: {
        white: '#fffcf4',
        rubrica: '#8b2a1d',
        // Tinta e pergaminho no lugar dos cinzas frios.
        slate: {
          50: '#f4efe5',
          100: '#ebe3d3',
          200: '#ddd1bb',
          300: '#c8b89c',
          400: '#a39175',
          500: '#7f6b55',
          600: '#645240',
          700: '#4d3d2f',
          800: '#382a20',
          900: '#271b13',
          950: '#1e1208',
        },
        gray: {
          50: '#f4efe5',
          100: '#ebe3d3',
          200: '#ddd1bb',
          300: '#c8b89c',
          400: '#a39175',
          500: '#7f6b55',
          600: '#645240',
          700: '#4d3d2f',
          800: '#382a20',
          900: '#271b13',
          950: '#1e1208',
        },
        // Verde do boletim (#365c4d) como cor de ação.
        emerald: {
          50: '#eef4f0',
          100: '#dbe8df',
          200: '#b8d0c0',
          300: '#8fb39d',
          400: '#6a9a80',
          500: '#477a62',
          600: '#365c4d',
          700: '#2c4c40',
          800: '#233d33',
          900: '#17352b',
          950: '#0f241d',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
    },
  },
  plugins: [],
}