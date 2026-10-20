// Set BASE_PATH when the site is served from a sub-folder (e.g. GitHub Pages at /KNn).
const configuredBasePath = process.env.BASE_PATH;
const basePath =
  configuredBasePath && configuredBasePath !== '/'
    ? configuredBasePath.replace(/\/$/, '')
    : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
};

export default nextConfig;
