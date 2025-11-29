import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '172.31.0.165',
        port: '',
        pathname: '/LOCALS/pic/enrlFace/0/**',
      },
      {
        protocol: 'https',
        hostname: '172.31.0.164',
        port: '',
        pathname: '/LOCALS/pic/enrlFace/0/**',
      },
    ],
    unoptimized: true, // Desactiva la optimización para estas imágenes
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;

export default nextConfig;
