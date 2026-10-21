import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { LISTING_STATUS, PRICE_BANDS, type BusinessHours } from '@/lib/business/constants';
import { formatPrice, hoursRows } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';

export const metadata: Metadata = { title: 'Preview listing | Business Panel | KashiNagri', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, active } = await getBusinessContext();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: listing } = await supabase
    .from('listings')
    .select('*, listing_categories ( name )')
    .eq('id', id)
    .eq('business_id', active.id)
    .maybeSingle();
  if (!listing) notFound();

  const { data: imageRows } = await supabase
    .from('listing_images').select('storage_path, alt_text, is_cover').eq('listing_id', id).order('sort_order').order('created_at');
  const images = (imageRows ?? []).map(i => ({
    alt: (i.alt_text as string | null) ?? listing.title,
    cover: i.is_cover as boolean,
    url: supabase.storage.from('listing-images').getPublicUrl(i.storage_path).data.publicUrl,
  }));
  const cover = images.find(i => i.cover) ?? images[0];
  const category = Array.isArray(listing.listing_categories) ? listing.listing_categories[0] : listing.listing_categories;
  const hours = hoursRows(listing.business_hours as BusinessHours | null);
  const price = formatPrice(listing.price_from, listing.price_to, listing.price_note);
  const band = PRICE_BANDS.find(b => b.value === listing.price_band)?.label;
  const status = LISTING_STATUS[listing.status];

  return <>
    <PageHeader
      title="Preview"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Listings', href: '/business/listings/' }, { label: listing.title, href: `/business/listings/${id}/edit/` }, { label: 'Preview' }]}
      actions={<Link href={`/business/listings/${id}/edit/`} className="bp-btn-secondary">Back to editing</Link>}
    />
    <p className="bp-banner bp-banner-info">
      This is how your listing will look to travellers. Only you can see this preview. Current status: <StatusBadge label={status?.label ?? listing.status} tone={status?.tone ?? 'neutral'} />
    </p>

    <article className="bp-preview">
      {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img className="bp-preview-cover" src={cover.url} alt={cover.alt} />}
      <div className="bp-preview-body">
        <span className="eyebrow">{[category?.name, listing.subtype].filter(Boolean).join(' · ')}</span>
        <h2 className="serif">{listing.title}</h2>
        {listing.summary && <p className="bp-preview-summary">{listing.summary}</p>}
        <p className="bp-preview-meta">
          {(listing.area || listing.address) && <span><MapPin size={14} /> {[listing.area, listing.address].filter(Boolean).join(', ')}</span>}
          {(price || band) && <span>{[band, price].filter(Boolean).join(' · ')}</span>}
        </p>
        {listing.description && <p className="bp-preview-text">{listing.description}</p>}

        {images.length > 1 && <ul className="bp-image-grid bp-preview-gallery">{images.map(image => <li key={image.url}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={image.alt} loading="lazy" /></li>)}</ul>}

        {(listing.amenities ?? []).length > 0 && <ul className="bp-chips">{(listing.amenities as string[]).map(a => <li key={a}>{a}</li>)}</ul>}

        {hours.length > 0 && <section><h3><Clock size={14} /> Opening hours</h3>
          <dl className="bp-hours-list">{hours.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>}

        {(listing.contact_phone || listing.contact_email || listing.website) && <section><h3>Contact</h3>
          <ul className="bp-plain-list">
            {listing.contact_phone && <li><Phone size={14} /> {listing.contact_phone}</li>}
            {listing.contact_email && <li><Mail size={14} /> {listing.contact_email}</li>}
            {listing.website && <li><Globe size={14} /> {listing.website}</li>}
          </ul></section>}
      </div>
    </article>
  </>;
}
