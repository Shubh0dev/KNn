import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer, Header } from '../../../../App';
import { requireSignedIn } from '@/lib/auth/session';
import { getPublicListing } from '@/lib/public/listings';
import { EnquiryForm } from './EnquiryForm';

export const metadata: Metadata = { title: 'Send an enquiry | KashiNagri', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireSignedIn(`/listings/${slug}/enquire/`);
  const listing = await getPublicListing(slug);
  // Curated (platform) places have no business to receive enquiries.
  if (!listing || !listing.businessName) notFound();
  return <><Header /><main className="page-shell public-report">
    <div className="auth-card">
      <span className="eyebrow">Send an enquiry</span>
      <h1 className="serif">{listing.title}</h1>
      <p className="auth-lede">Your message goes to {listing.businessName}. KashiNagri does not take bookings or payments.</p>
      <EnquiryForm listingId={listing.id} slug={slug} name={access.profile?.full_name ?? ''} email={access.user.email ?? ''} />
      <div className="auth-links"><Link href={`/listings/${slug}/`}>Back to the listing</Link></div>
    </div>
  </main><Footer /></>;
}
