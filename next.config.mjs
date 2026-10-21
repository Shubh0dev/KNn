// Set BASE_PATH only when the site is served from a sub-folder.
const configuredBasePath = process.env.BASE_PATH;
const basePath =
  configuredBasePath && configuredBasePath !== '/'
    ? configuredBasePath.replace(/\/$/, '')
    : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs as a Next.js server (not a static export) so that Supabase Auth can use
  // cookie-based sessions, the proxy, Server Actions and server-side route guards.
  trailingSlash: true,
  basePath,
  env: {
    // Exposed so plain asset URLs (e.g. background images) can be prefixed too.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  // Pin the project root so stray lockfiles in parent folders are ignored.
  turbopack: {
    root: import.meta.dirname,
  },
  agentRules: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
