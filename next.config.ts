import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000', '192.168.1.17:3000'],
  experimental: {
    // @ts-ignore - necessary if types are not up to date
    allowedDevOrigins: ['192.168.56.1', 'localhost:3000'],
  } as any, 
  devIndicators: {
    position: 'bottom-left',
  },
};

export default nextConfig;
