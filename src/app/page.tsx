import { HomePage } from '../App';
import { getHomeFeatured } from '@/lib/public/listings';

// Re-generated at most every 5 minutes (and on demand after content changes).
export const revalidate = 300;

export default async function Page() {
  const featured = await getHomeFeatured();
  return <HomePage featured={featured} />;
}
