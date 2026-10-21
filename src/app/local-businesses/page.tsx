import type { Metadata } from 'next';
import { CategoryPage } from '../../DiscoveryPages';
import { DirectorySection } from '@/components/public/DirectorySection';
import { getDirectory } from '@/lib/public/listings';
import { categoryMetadata } from '../../discovery-data';

export const metadata: Metadata = categoryMetadata('local-businesses');
// Re-generated at most every 5 minutes (and on demand after admin changes).
export const revalidate = 300;

export default async function Page() {
  const cards = await getDirectory('all-businesses');
  return <CategoryPage slug="local-businesses" directory={<DirectorySection cards={cards} showEmpty />} />;
}
