import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../index.css';

export const metadata: Metadata = {
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
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
