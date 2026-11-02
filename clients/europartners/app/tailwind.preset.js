/**
 * Europartners — Tailwind CSS preset (v3.4+).
 * Requiere tokens.css cargado (las clases apuntan a variables CSS, así el tema oscuro
 * se resuelve con <html data-theme="dark"> sin clases dark:).
 * Uso: tailwind.config.js → presets: [require('./tailwind.preset.js')]
 */
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px'
    },
    extend: {
      colors: {
        'ultramar': 'var(--ultramar)',
        'ultramar-ink': 'var(--ultramar-ink)',
        'indigo': 'var(--indigo)',
        'indigo-deep': 'var(--indigo-deep)',
        'cuarzo': 'var(--cuarzo)',
        'cuarzo-soft': 'var(--cuarzo-soft)',
        'marmol': 'var(--marmol)',
        'gris-manual': 'var(--gris-manual)',
        'neutral-0': 'var(--neutral-0)',
        'neutral-100': 'var(--neutral-100)',
        'neutral-200': 'var(--neutral-200)',
        'neutral-300': 'var(--neutral-300)',
        'neutral-400': 'var(--neutral-400)',
        'neutral-500': 'var(--neutral-500)',
        'neutral-600': 'var(--neutral-600)',
        'neutral-900': 'var(--neutral-900)',
        'noche-900': 'var(--noche-900)',
        'noche-800': 'var(--noche-800)',
        'noche-700': 'var(--noche-700)',
        'noche-600': 'var(--noche-600)',
        'indigo-light': 'var(--indigo-light)',
        'indigo-pale': 'var(--indigo-pale)',
        'bg-page': 'var(--bg-page)',
        'bg-surface': 'var(--bg-surface)',
        'bg-subtle': 'var(--bg-subtle)',
        'bg-brand': 'var(--bg-brand)',
        'bg-accent': 'var(--bg-accent)',
        'bg-selected': 'var(--bg-selected)',
        'text': 'var(--text)',
        'text-heading': 'var(--text-heading)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        'text-link': 'var(--text-link)',
        'text-on-brand': 'var(--text-on-brand)',
        'text-on-accent': 'var(--text-on-accent)',
        'border': 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-control': 'var(--border-control)',
        'focus-ring': 'var(--focus-ring)',
        'action-primary': 'var(--action-primary)',
        'action-primary-hover': 'var(--action-primary-hover)',
        'on-action-primary': 'var(--on-action-primary)',
        'success': 'var(--success)',
        'success-bg': 'var(--success-bg)',
        'warning': 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        'danger': 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
        'on-danger': 'var(--on-danger)',
        'info': 'var(--info)',
        'info-bg': 'var(--info-bg)'
      },
      fontFamily: {
        display: ['Quicksand', 'Avenir Next', 'system-ui', 'sans-serif'],
        body: ['Work Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Work Sans', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '60px', fontWeight: '400', letterSpacing: '-0.01em' }],
        'display-lg': ['40px', { lineHeight: '46px', fontWeight: '500' }],
        'heading-1': ['30px', { lineHeight: '36px', fontWeight: '600' }],
        'heading-2': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'heading-3': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'figure-lg': ['36px', { lineHeight: '40px', fontWeight: '600' }],
        'text-body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'text-body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'text-body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'text-label': ['13px', { lineHeight: '16px', fontWeight: '500' }],
        'text-button': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'text-caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'text-overline': ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.08em' }],
        'text-code': ['13px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '0.02em' }]
      },
      spacing: {
        '0.5': 'var(--space-0-5)',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '24': 'var(--space-24)'
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        'pill': 'var(--radius-pill)'
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)'
      },
      height: { 'control-sm': 'var(--control-sm)', 'control-md': 'var(--control-md)', 'control-lg': 'var(--control-lg)', 'row-compact': 'var(--row-compact)', 'row-default': 'var(--row-default)' },
      maxWidth: { content: 'var(--content-max)' },
      zIndex: { sticky: '10', dropdown: '100', modal: '1000', toast: '1100' }
    }
  }
};
