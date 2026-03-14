/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary (Brand Identity) - Agro Green
        primary: {
          DEFAULT: '#16a34a',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a', // Agro Green - primary actions, active nav, user chat
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Deep Slate - Navigation
        nav: {
          DEFAULT: '#0f172a',
          hover: '#1e293b', // slate-800
        },
        // Tech Blue (weather, recommendations, login accents)
        tech: {
          blue: '#2563eb',
          indigo: '#4f46e5',
        },
        // Alert Orange (pending tasks, market alerts)
        alert: {
          orange: '#ea580c',
          orangeBg: '#ffedd5',
        },
        // AI Purple (chatbot, AI badges)
        ai: {
          purple: '#9333ea',
          purpleBg: '#f3e8ff',
        },
        // Semantic backgrounds
        surface: '#f9fafb', // gray-50 - main background
        card: '#ffffff',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem', // 16px - rounded-2xl equivalent for semantic use
      },
      boxShadow: {
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      minHeight: {
        touch: '44px', // Accessibility: minimum touch target
      },
    },
  },
  plugins: [],
};
