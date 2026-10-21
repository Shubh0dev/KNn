import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Clock, Flag, Globe, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { Footer, Header } from '../../../App';
import { TrackedLink, ViewTracker } from '@/components/public/ListingTracking';
import { PRICE_BANDS, type BusinessHours } from '@/lib/business/constants';
import { formatPrice, hoursRows } from '@/lib/business/format';
import { getPublicListing } from '@/lib/public/listings';

// Rendered on first request, then cached; refreshed every 5 minutes and right after moderation changes.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublicListing((await params).slug);
  if (!listing) return { title: 'Not found | KashiNagri' };
  return { title: `${listing.title} | KashiNagri`, description: listing.summary ?? listing.description?.slice(0, 160) ?? undefined };
}

export default async function Page({ params }: Props) {
  const listing = await getPublicListing((await params).slug);
  if (!listing) notFound();

  const hours = hoursRows(listing.business_hours as BusinessHours | null);
  const price = formatPrice(listing.price_from, listing.price_to, listing.price_note);
  const band = PRICE_BANDS.find(b => b.value === listing.price_band)?.label;
  const directions = listing.latitude != null && listing.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}` : null;

  return <><Header /><main className="page-shell public-listing">
    <ViewTracker listingId={listing.id} />
    <nav className="public-listing-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/local-businesses/">Directory</Link> / <span>{listing.title}</span></nav>
    {listing.images[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img className="public-listing-cover" src={listing.images[0].url} alt={listing.images[0].alt} />}
    <div className="public-listing-grid">
      <article>
        <span className="eyebrow">{[listing.category, listing.subtype].filter(Boolean).join(' · ')}</span>
        <h1 className="serif">{listing.title}</h1>
        <p className="public-listing-trust">{listing.businessName
          ? <><BadgeCheck size={15} /> {listing.businessName} · verified business</>
          : <>KashiNagri curated</>}</p>
        {listing.summary && <p className="public-listing-summary">{listing.summary}</p>}
        {listing.description && <p className="public-listing-text">{listing.description}</p>}
        {listing.images.length > 1 && <ul className="public-listing-gallery">{listing.images.slice(1).map(img => <li key={img.url}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={img.url} alt={img.alt} loading="lazy" /></li>)}</ul>}
        {listing.amenities.length > 0 && <ul className="bp-chips">{listing.amenities.map(a => <li key={a}>{a}</li>)}</ul>}
      </article>
      <aside className="public-listing-aside">
        {(listing.area || listing.address) && <p><MapPin size={15} /> {[listing.address, listing.area].filter(Boolean).join(', ')}</p>}
        {(band || price) && <p><strong>{[band, price].filter(Boolean).join(' · ')}</strong></p>}
        {hours.length > 0 && <div><h2><Clock size={14} /> Opening hours</h2><dl className="bp-hours-list">{hours.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></div>}
        <div className="public-listing-actions">
          {listing.contact_phone && <TrackedLink listingId={listing.id} type="contact_click" href={`tel:${listing.contact_phone.replace(/[^+\d]/g, '')}`} className="button-primary"><Phone size={15} /> Call</TrackedLink>}
          {listing.contact_email && <TrackedLink listingId={listing.id} type="contact_click" href={`mailto:${listing.contact_email}`} className="partner-secondary"><Mail size={15} /> Email</TrackedLink>}
          {listing.website && <TrackedLink listingId={listing.id} type="website_click" href={listing.website} className="partner-secondary"><Globe size={15} /> Website</TrackedLink>}
          {directions && <TrackedLink listingId={listing.id} type="direction_click" href={directions} className="partner-secondary"><Navigation size={15} /> Directions</TrackedLink>}
        </div>
        <p className="public-listing-note">Details are provided by the business and checked by our team when submitted. Please confirm timings and prices directly.</p>
        <Link href={`/listings/${listing.slug}/report/`} className="public-listing-report" data-testid="link-report-listing"><Flag size={13} /> Report a problem with this listing</Link>
      </aside>
    </div>
  </main><Footer /></>;
}
