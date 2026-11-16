import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    dangerouslyAllowSVG: true,
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3001'] }
  },
  async redirects() {
    return [
      { source: '/driver', destination: '/admin/driver', permanent: false },
      { source: '/driver/:path*', destination: '/admin/driver/:path*', permanent: false },
      { source: '/admin/drivers', destination: '/admin/driver', permanent: false },
      { source: '/livreur', destination: '/admin/driver', permanent: false },
    ]
  },
}
export default nextConfig
