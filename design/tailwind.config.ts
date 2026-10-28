/**
 * OpsPulse — Tailwind configuration
 * ---------------------------------------------------------------------------
 * tokens.css is the single source of truth for every visual value. This file
 * only *renames* those tokens; it never introduces a colour, size or duration
 * that is not defined in tokens.css.
 *
 * Every colour is a CSS custom property reference, so a theme switch
 * (data-theme="dark" | "light") or a density switch
 * (data-density="comfortable" | "compact") cascades without rebuilding.
 *
 * Next.js (App Router) + Tailwind v4 note: with v4 the theme block lives in
 * CSS via `@theme`. In that case delete the `theme` object below and paste the
 * token map into `@theme inline { ... }` instead — the token *names* stay
 * identical either way, so component class names do not change.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // surfaces
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          inset: 'var(--surface-inset)',
        },
        // foreground
        fg: 'var(--fg)',
        'fg-2': 'var(--fg-2)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        // lines
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          accent: 'var(--border-accent)',
        },
        // one accent
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
          on: 'var(--accent-on)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
        },
        // functional status palette — never decorative
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        stale: { DEFAULT: 'var(--stale)', soft: 'var(--stale-soft)' },
        // data visualisation
        viz: {
          seq: {
            1: 'var(--viz-seq-1)', 2: 'var(--viz-seq-2)', 3: 'var(--viz-seq-3)',
            4: 'var(--viz-seq-4)', 5: 'var(--viz-seq-5)', 6: 'var(--viz-seq-6)',
            7: 'var(--viz-seq-7)',
          },
          cat: {
            1: 'var(--viz-cat-1)', 2: 'var(--viz-cat-2)', 3: 'var(--viz-cat-3)',
            4: 'var(--viz-cat-4)', 5: 'var(--viz-cat-5)', 6: 'var(--viz-cat-6)',
          },
        },
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        '11': 'var(--fs-11)',
        '12': 'var(--fs-12)',
        '13': 'var(--fs-13)',
        '14': 'var(--fs-14)',
        '16': 'var(--fs-16)',
        '18': 'var(--fs-18)',
        '22': 'var(--fs-22)',
        '28': 'var(--fs-28)',
        '36': 'var(--fs-36)',
      },
      lineHeight: {
        tight: 'var(--lh-tight)',
        snug: 'var(--lh-snug)',
        body: 'var(--lh-body)',
      },
      letterSpacing: {
        display: 'var(--track-display)',
        tight: 'var(--track-tight)',
        label: 'var(--track-label)',
      },
      spacing: {
        1: 'var(--sp-1)', 2: 'var(--sp-2)', 3: 'var(--sp-3)', 4: 'var(--sp-4)',
        5: 'var(--sp-5)', 6: 'var(--sp-6)', 8: 'var(--sp-8)', 10: 'var(--sp-10)',
        12: 'var(--sp-12)', 16: 'var(--sp-16)',
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', pill: 'var(--r-pill)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)',
      },
      transitionDuration: {
        1: 'var(--dur-1)', 2: 'var(--dur-2)', 3: 'var(--dur-3)',
        4: 'var(--dur-4)', 5: 'var(--dur-5)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        inout: 'var(--ease-inout)',
      },
      zIndex: {
        sticky: 'var(--z-sticky)', dropdown: 'var(--z-dropdown)',
        overlay: 'var(--z-overlay)', toast: 'var(--z-toast)',
      },
      screens: {
        xs: '400px', sm: '600px', md: '768px', lg: '1024px',
        xl: '1200px', '2xl': '1440px',
      },
      keyframes: {
        'feed-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'row-settle': {
          '0%': { backgroundColor: 'var(--accent-soft)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'live-pulse': {
          '0%': { boxShadow: '0 0 0 0 var(--accent-soft)' },
          '70%': { boxShadow: '0 0 0 6px transparent' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'feed-in': 'op-feed-in var(--dur-3) var(--ease-out)',
        'row-settle': 'op-row-settle var(--dur-4) var(--ease-out)',
        'live-pulse': 'op-live-pulse var(--dur-5) var(--ease-inout) infinite',
        spin: 'op-spin 900ms linear infinite',
        'toast-in': 'op-toast-in var(--dur-3) var(--ease-out)',
      },
    },
  },
  plugins: [],
};

export default config;
