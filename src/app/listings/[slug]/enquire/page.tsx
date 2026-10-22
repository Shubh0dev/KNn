import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone } from 'lucide-react';
import { Footer, Header } from '../../../../App';
import { getAccess } from '@/lib/auth/session';
import { getPublicListing } from '@/lib/public/listings';
import { KIND_COPY, enquiryKind, telHref } from '@/lib/enquiries/rules';
import { EnquiryForm } from './EnquiryForm';

export const metadata: Metadata = { title: 'Send a request | KashiNagri', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const listing = await getPublicListing(slug);
  // Curated (platform) places have no business to receive enquiries.
  if (!listing || !listing.businessName) notFound();
  const offered = enquiryKind(listing.categorySlug, listing.enquiryMode);
  const askGeneral = (await searchParams).type === 'general';
  const kind = offered === 'none' ? 'none' : askGeneral ? 'general' : offered;
  const access = await getAccess();
  const copy = kind === 'none' ? null : KIND_COPY[kind];

  return <><Header /><main className="page-shell public-report">
    <div className="auth-card enquiry-card">
      <span className="eyebrow">{copy?.title ?? 'Contact'}</span>
      <h1 className="serif">{listing.title}</h1>
      <p className="auth-lede">Your request goes to <strong>{listing.businessName}</strong>.</p>
      {listing.publicPhone && <p className="enquiry-direct">Prefer to talk first? <a href={telHref(listing.publicPhone)} data-testid="enquire-business-phone"><Phone size={14} /> {listing.publicPhone}</a></p>}
      {kind === 'none'
        ? <p className="auth-notice" role="status">This business takes requests by phone or email only. Please use the contact details on the listing.</p>
        : <>
            <p className="enquiry-notice" data-testid="enquiry-notice">{copy!.notice}</p>
            {access && access.profile?.account_status !== 'active' && <p className="auth-notice auth-error" role="alert">Your account is not active, so it cannot send requests.</p>}
            <EnquiryForm
              listingId={listing.id} slug={slug} kind={kind} offered={offered === 'none' ? 'general' : offered} businessName={listing.businessName}
              signedIn={Boolean(access)} name={access?.profile?.full_name ?? ''} email={access?.user.email ?? ''}
            />
          </>}
      <div className="auth-links"><Link href={`/listings/${slug}/`}>Back to the listing</Link></div>
    </div>
  </main><Footer /></>;
}
