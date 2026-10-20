import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailPage } from '../../../DiscoveryPages';
import { getItem, items } from '../../../discovery-data';

export const dynamicParams = false;
export function generateStaticParams() { return items.filter((item) => item.category === 'guides').map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'guides') return { title: 'Guide not found | KashiNagri', description: 'This illustrative guide could not be found.' };
  return { title: `${entry.title} | KashiNagri guides`, description: `${entry.overview} An illustrative guide idea, not a verified tour or service.` };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'guides') notFound();
  return <DetailPage slug={slug} allowed={['guides']} />;
}
