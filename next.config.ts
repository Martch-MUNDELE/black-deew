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
  }
}
export default nextConfig
