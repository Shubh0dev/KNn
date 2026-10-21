import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer, Header } from '../../../../App';
import { requireSignedIn } from '@/lib/auth/session';
import { getPublicListing } from '@/lib/public/listings';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'Report a listing | KashiNagri', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireSignedIn(`/listings/${slug}/report/`);
  const listing = await getPublicListing(slug);
  if (!listing) notFound();
  return <><Header /><main className="page-shell public-report">
    <div className="auth-card">
      <span className="eyebrow">Report a problem</span>
      <h1 className="serif">{listing.title}</h1>
      <p className="auth-lede">Reports go to the KashiNagri team. A report never removes a listing on its own; a person reviews it first.</p>
      <ReportForm listingId={listing.id} slug={slug} />
      <div className="auth-links"><Link href={`/listings/${slug}/`}>Back to the listing</Link></div>
    </div>
  </main><Footer /></>;
}
