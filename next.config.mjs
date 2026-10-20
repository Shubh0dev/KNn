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
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
