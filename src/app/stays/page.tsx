import type { Metadata } from 'next';
import { StaysDiscoveryPage } from '../../DiscoveryPages';
import { DirectorySection } from '@/components/public/DirectorySection';
import { getDirectory } from '@/lib/public/listings';

export const metadata: Metadata = {
  title: 'Stay in Kashi | Accommodation ideas | KashiNagri',
  description: 'Explore illustrative accommodation styles in Varanasi with area shortcuts, non-numeric budget bands, and sample room and amenity filters.',
};
// Re-generated at most every 5 minutes (and on demand after admin changes).
export const revalidate = 300;

export default async function Page() {
  const cards = await getDirectory(['stays']);
  return <StaysDiscoveryPage directory={<DirectorySection cards={cards} title="Verified stays on KashiNagri" showEmpty />} />;
}
