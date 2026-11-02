/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  webpack: (config) => {
    // Evitar que canvas (opcional de @react-pdf) falle en build
    config.resolve.alias.canvas = false
    return config
  },
  // Cabeceras de seguridad (auditoría oct-2026) — Vercel ya agrega
  // Strict-Transport-Security por defecto en todo el edge, por eso no se
  // repite aquí. CSP queda pendiente a propósito: necesita mapear todos los
  // orígenes externos reales (Supabase Storage, fuentes, el script inline
  // anti-flash de app/layout.tsx) antes de activarse, para no romper nada en
  // producción sin probarlo primero — ver reporte de seguridad.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ]
  },
}

export default nextConfig;
