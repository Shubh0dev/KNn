import type { Metadata } from 'next';
import { PageHeader } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { defaultCategorySlug } from '@/lib/business/constants';
import { createListing } from '../actions';
import { ListingForm } from '../ListingForm';

export const metadata: Metadata = { title: 'New listing | Business Panel | KashiNagri', robots: { index: false } };

export default async function Page() {
  const { supabase, active } = await getBusinessContext();
  const { data } = await supabase.from('listing_categories').select('id, slug, name').eq('is_active', true).order('sort_order');
  const categories = (data ?? []) as { id: string; slug: string; name: string }[];
  const preferred = categories.find(c => c.slug === defaultCategorySlug(active.business_type));

  return <>
    <PageHeader
      title="New listing"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Listings', href: '/business/listings/' }, { label: 'New listing' }]}
      lede="Start with a draft. Nothing is public until you submit it and our team approves it."
    />
    <ListingForm
      action={createListing}
      categories={categories}
      defaults={{ category_id: preferred?.id, area: undefined }}
      submitLabel="Save draft"
      cancelHref="/business/listings/"
    />
  </>;
}
