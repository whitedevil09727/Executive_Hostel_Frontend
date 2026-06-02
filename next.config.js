/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  webpack: (config) => {
    // Disable filesystem cache — avoids "Unable to snapshot" warnings on Windows
    config.cache = false;
    return config;
  },
}

module.exports = nextConfig
