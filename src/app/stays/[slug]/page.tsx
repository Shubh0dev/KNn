import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailPage } from '../../../DiscoveryPages';
import { getItem, items } from '../../../discovery-data';

export const dynamicParams = false;
export function generateStaticParams() { return items.filter((item) => item.category === 'stays').map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'stays') return { title: 'Stay idea not found | KashiNagri', description: 'This illustrative stay idea could not be found.' };
  return { title: `${entry.title} | Stay ideas in Kashi | KashiNagri`, description: `${entry.overview} Illustrative, unverified accommodation category; no live property or rates.` };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || entry.category !== 'stays') notFound();
  return <DetailPage slug={slug} allowed={['stays']} />;
}
