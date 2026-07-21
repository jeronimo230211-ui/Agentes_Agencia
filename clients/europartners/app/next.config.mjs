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
}

export default nextConfig;
