import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailPage } from '../../../DiscoveryPages';
import { getItem, items } from '../../../discovery-data';

export const dynamicParams = false;
export function generateStaticParams() { return items.filter((item) => item.category === 'food').map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'food') return { title: 'Food discovery not found | KashiNagri', description: 'This illustrative food discovery could not be found.' };
  return { title: `${entry.title} | Food in Kashi | KashiNagri`, description: `${entry.overview} An illustrative, unverified Kashi food discovery.` };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'food') notFound();
  return <DetailPage slug={slug} allowed={['food']} />;
}
