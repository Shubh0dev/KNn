import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import '../index.css';
import { Analytics } from '@/components/analytics/Analytics';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kashinagri.com'),
  title: 'KashiNagri — Your Complete Guide to Kashi',
  description:
    'Find your way into Varanasi with thoughtful discovery ideas for ghats, temples, stays, food, local experiences and trip planning.',
  openGraph: {
    title: 'KashiNagri — Your Complete Guide to Kashi',
    description:
      'A thoughtful starting point for discovering the many layers of Kashi.',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  themeColor: '#fbf8f0',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body>{children}<Analytics /></body>
    </html>
  );
}
