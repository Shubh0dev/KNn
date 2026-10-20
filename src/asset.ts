const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix a /public file path with the site's base path (needed when hosted under a sub-folder). */
export const asset = (path: string) => `${basePath}${path}`;
