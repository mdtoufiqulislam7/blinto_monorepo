// The browser calls same-origin /api/*; Next proxies it to the API server.
// API_URL is read at build time (rewrites are baked into the build), so docker-compose passes it as a build arg.
const API_URL = process.env.API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
export default nextConfig;
