import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kashinagri.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/superadmin/', '/business/', '/account/', '/auth/', '/api/', '/login/', '/register/', '/forgot-password/', '/reset-password/', '/listings/*/report/', '/listings/*/enquire/'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
