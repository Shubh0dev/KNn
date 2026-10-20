import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailPage } from '../../../DiscoveryPages';
import { getItem, items, type CategorySlug } from '../../../discovery-data';

const allowed: CategorySlug[] = ['temples', 'ghats', 'travel', 'shopping', 'spiritual-services', 'events', 'local-businesses', 'areas'];
export const dynamicParams = false;
export function generateStaticParams() { return items.filter((item) => allowed.includes(item.category)).map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || !allowed.includes(entry.category)) return { title: 'Discovery not found | KashiNagri', description: 'This illustrative discovery could not be found.' };
  return { title: `${entry.title} | KashiNagri`, description: `${entry.overview} Illustrative and unverified Kashi discovery.` };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getItem(slug);
  if (!entry || !allowed.includes(entry.category)) notFound();
  return <DetailPage slug={slug} allowed={allowed} />;
}
