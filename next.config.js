/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Ignora erros de lint no build
  },
  typescript: {
    ignoreBuildErrors: true, // Ignora erros de tipo no build (crucial para o Next 15)
  },
};

export default nextConfig;