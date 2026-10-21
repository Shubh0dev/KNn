import type { Metadata } from 'next';
import { FlashNotice, PageHeader } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { ListingQueue } from './ListingQueue';

export const metadata: Metadata = { title: 'Listing reviews | Admin | KashiNagri', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission('listings.moderate');
  const params = await searchParams;
  return <>
    <PageHeader title="Listing reviews" crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Listing reviews' }]}
      lede="Oldest submissions first. Open a listing to preview it and record a decision." />
    <FlashNotice params={params} />
    <ListingQueue ctx={ctx} params={params} basePath="/admin/listings/" defaultStatus="pending_review"
      statusOptions={['pending_review', 'attention', 'changes_requested', 'rejected', 'published', 'suspended', 'archived', 'draft', 'all']} />
  </>;
}
