const configuredBasePath = process.env.BASE_PATH;
const basePath =
  configuredBasePath && configuredBasePath !== '/'
    ? configuredBasePath.replace(/\/$/, '')
    : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
