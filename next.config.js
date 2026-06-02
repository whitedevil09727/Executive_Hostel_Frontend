/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  webpack: (config) => {
    // Disable filesystem cache — avoids "Unable to snapshot" warnings on Windows
    config.cache = false;
    return config;
  },
  // Proxy /api/* to the backend service at runtime using BACKEND_URL env var.
  // This avoids CORS entirely — the browser calls /api/* on the same origin,
  // and Next.js server forwards the request to the Spring Boot backend.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
