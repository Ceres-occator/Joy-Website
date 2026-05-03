import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // @ts-ignore - necessary if types are not up to date
    allowedDevOrigins: ['192.168.56.1', 'localhost:3000'],
  } as any, 
};

export default nextConfig;
