import type { Metadata } from 'next';
import { FlashNotice, PageHeader } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { ListingQueue } from '../listings/ListingQueue';

export const metadata: Metadata = { title: 'Published listings | Admin | KashiNagri', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission('listings.moderate');
  const params = await searchParams;
  return <>
    <PageHeader title="Published listings" crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Published listings' }]}
      lede="Live and suspended listings. Business verification and listing status are separate: a verified business can still have a suspended listing." />
    <FlashNotice params={params} />
    <ListingQueue ctx={ctx} params={params} basePath="/admin/published/" defaultStatus="published" statusOptions={['published', 'suspended', 'archived']} />
  </>;
}
