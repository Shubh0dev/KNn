import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, CalendarCheck, Clock, Flag, Globe, Mail, MapPin, MessageCircle, MessageSquare, Navigation, Phone } from 'lucide-react';
import { Footer, Header } from '../../../App';
import { TrackedLink, ViewTracker } from '@/components/public/ListingTracking';
import { PRICE_BANDS, type BusinessHours } from '@/lib/business/constants';
import { formatPrice, hoursRows } from '@/lib/business/format';
import { getPublicListing } from '@/lib/public/listings';
import { KIND_COPY, enquiryKind, telHref, whatsappHref } from '@/lib/enquiries/rules';

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
  const kind = listing.businessName ? enquiryKind(listing.categorySlug, listing.enquiryMode) : 'none';
  // WhatsApp only when the business turned it on and the listing number can be a WhatsApp number.
  const whatsapp = listing.whatsappEnabled ? whatsappHref(listing.contact_phone, `Namaste, I found ${listing.title} on KashiNagri.`) : null;

  return <><Header /><main className="page-shell public-listing">
    <ViewTracker listingId={listing.id} />
    <nav className="public-listing-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/directory/">Directory</Link> / <span>{listing.title}</span></nav>
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
        <section className="public-listing-contact" aria-labelledby="contact-title">
          <h2 id="contact-title">{listing.businessName ? `Contact ${listing.businessName}` : 'Contact and visiting'}</h2>
          {listing.publicPhone
            ? <TrackedLink listingId={listing.id} type="contact_click" href={telHref(listing.publicPhone)} className="public-listing-phone" data-testid="listing-phone"><Phone size={16} /> <span>{listing.publicPhone}</span></TrackedLink>
            : <p className="public-listing-muted" data-testid="listing-no-phone">No phone number is published for this listing.</p>}
          <div className="public-listing-actions">
            {kind !== 'none' && <Link href={`/listings/${listing.slug}/enquire/`} className="button-primary" data-testid="link-enquire">{kind === 'general' ? <MessageSquare size={15} /> : <CalendarCheck size={15} />} {KIND_COPY[kind].cta}</Link>}
            {listing.publicPhone && <TrackedLink listingId={listing.id} type="contact_click" href={telHref(listing.publicPhone)} className="partner-secondary" data-testid="link-call"><Phone size={15} /> Call</TrackedLink>}
            {whatsapp && <TrackedLink listingId={listing.id} type="contact_click" href={whatsapp} className="partner-secondary" data-testid="link-whatsapp"><MessageCircle size={15} /> WhatsApp</TrackedLink>}
            {listing.contact_email && <TrackedLink listingId={listing.id} type="contact_click" href={`mailto:${listing.contact_email}`} className="partner-secondary"><Mail size={15} /> Email</TrackedLink>}
            {listing.website && <TrackedLink listingId={listing.id} type="website_click" href={listing.website} className="partner-secondary"><Globe size={15} /> Website</TrackedLink>}
            {directions && <TrackedLink listingId={listing.id} type="direction_click" href={directions} className="partner-secondary"><Navigation size={15} /> Directions</TrackedLink>}
          </div>
          {kind !== 'none' && kind !== 'general' && <p className="public-listing-muted">{KIND_COPY[kind].notice} You can also call the business to check availability.</p>}
          {listing.businessName && kind === 'none' && <p className="public-listing-muted">This business takes requests by phone or email.</p>}
          {!listing.businessName && <p className="public-listing-muted">This is a KashiNagri curated guide, not a business. KashiNagri cannot book darshan, temple access or other official services; please use the official counters or websites.</p>}
        </section>
        <p className="public-listing-note">Details are provided by the business and checked by our team when submitted. Please confirm timings and prices directly.</p>
        <Link href={`/listings/${listing.slug}/report/`} className="public-listing-report" data-testid="link-report-listing"><Flag size={13} /> Report a problem with this listing</Link>
      </aside>
    </div>
  </main><Footer /></>;
}
