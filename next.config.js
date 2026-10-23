/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Ignora erros de lint no build
  },
  typescript: {
    ignoreBuildErrors: true, // Ignora erros de tipo no build (crucial para o Next 15)
  },
  // Metadados sempre no <head>: Chrome e iPhone só encontram o manifest e o ícone
  // do app (PWA do boletim) ali. Sem isso o Next 15.5 os envia no meio do <body>.
  htmlLimitedBots: /.*/,
};

export default nextConfig;