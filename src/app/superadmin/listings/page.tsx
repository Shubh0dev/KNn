import type { Metadata } from 'next';
import { FlashNotice, PageHeader } from '@/components/business/ui';
import { getSuperContext, requirePermission } from '@/lib/admin/context';
import { ListingQueue } from '@/app/admin/listings/ListingQueue';

export const metadata: Metadata = { title: 'All listings | Super Admin | KashiNagri', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await getSuperContext();
  const ctx = await requirePermission('listings.moderate');
  const params = await searchParams;
  return <>
    <PageHeader title="All listings" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'All listings' }]}
      lede="Every listing on the platform, including curated ones. Open a listing to see its history, decide, or apply an audited override." />
    <FlashNotice params={params} />
    <ListingQueue ctx={ctx} params={params} basePath="/superadmin/listings/" defaultStatus="all"
      statusOptions={['all', 'pending_review', 'published', 'suspended', 'attention', 'changes_requested', 'rejected', 'archived', 'draft']} />
  </>;
}
