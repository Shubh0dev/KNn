import type { Metadata } from 'next';
import { StaysDiscoveryPage } from '../../DiscoveryPages';

export const metadata: Metadata = {
  title: 'Stay in Kashi | Accommodation ideas | KashiNagri',
  description: 'Explore illustrative accommodation styles in Varanasi with area shortcuts, non-numeric budget bands, and sample room and amenity filters.',
};
export default function Page() { return <StaysDiscoveryPage />; }
