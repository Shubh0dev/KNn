import type { Metadata } from 'next';
import { PageHeader } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { ListingForm } from '@/app/business/(panel)/listings/ListingForm';
import { createCurated } from '../../actions';

export const metadata: Metadata = { title: 'New curated place | Super Admin | KashiNagri', robots: { index: false } };

export default async function Page() {
  const { supabase } = await getSuperContext();
  const { data } = await supabase.from('listing_categories').select('id, slug, name').order('sort_order');
  const categories = (data ?? []) as { id: string; slug: string; name: string }[];
  const temples = categories.find(c => c.slug === 'temples');
  return <>
    <PageHeader title="New curated place" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Website content', href: '/superadmin/content/' }, { label: 'New' }]}
      lede="Saved as a draft. Add photos, then publish it from the next page." />
    <ListingForm action={createCurated} categories={categories} defaults={{ category_id: temples?.id }} submitLabel="Save draft" cancelHref="/superadmin/content/" />
  </>;
}
