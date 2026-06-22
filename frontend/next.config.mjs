/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.updigit.net',
      },
      {
        protocol: 'https',
        hostname: 'auth.dgenx.net',
      },
    ],
  },
};

export default nextConfig;
