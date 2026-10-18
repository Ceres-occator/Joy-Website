import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000', '192.168.1.17:3000'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hjkjkqepkkjazilyzlpr.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  devIndicators: {
    position: 'bottom-left',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
