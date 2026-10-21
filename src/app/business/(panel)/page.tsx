import Link from 'next/link';
import { Check, Circle, Plus } from 'lucide-react';
import { EmptyState, FlashNotice, PageHeader, StatCard, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { LISTING_STATUS, VERIFICATION_STATUS } from '@/lib/business/constants';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // Layouts are not re-run on every navigation, so each page checks again.
  const { supabase, active } = await getBusinessContext();
  const params = await searchParams;

  const [listingsResult, enquiriesResult, documentsResult, engagementResult, activityResult, latestEnquiries] = await Promise.all([
    supabase.from('listings').select('id, status').eq('business_id', active.id),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('business_id', active.id).eq('status', 'new'),
    supabase.from('business_verification_documents').select('id', { count: 'exact', head: true }).eq('business_id', active.id),
    supabase.rpc('business_engagement_summary', { p_business_id: active.id, p_days: 30 }),
    supabase
      .from('listing_moderation_events')
      .select('id, to_status, note, created_at, listing_id, listings!inner ( title, business_id )')
      .eq('listings.business_id', active.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('enquiries')
      .select('id, sender_name, created_at, listings ( title )')
      .eq('business_id', active.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const listings = (listingsResult.data ?? []) as { id: string; status: string }[];
  const count = (...statuses: string[]) => listings.filter(l => statuses.includes(l.status)).length;
  const events = (engagementResult.data ?? []) as { event_type: string; event_count: number }[];
  const sum = (...types: string[]) => events.filter(e => types.includes(e.event_type)).reduce((n, e) => n + Number(e.event_count), 0);
  const hasEvents = events.length > 0;
  const documents = documentsResult.count ?? 0;
  const verification = VERIFICATION_STATUS[active.verification_status];

  const steps = [
    { done: true, label: 'Create your business profile' },
    { done: documents > 0, label: 'Upload a verification document', href: '/business/verification/' },
    { done: !['unverified', 'rejected'].includes(active.verification_status), label: 'Request verification', href: '/business/verification/' },
    { done: listings.length > 0, label: 'Create your first listing', href: '/business/listings/new/' },
    { done: listings.some(l => l.status !== 'draft'), label: 'Submit a listing for review', href: '/business/listings/' },
  ];

  return <>
    <PageHeader
      title={active.name}
      crumbs={[{ label: 'Business' }, { label: 'Overview' }]}
      lede="A snapshot of your listings, enquiries and visibility on KashiNagri."
      actions={<Link href="/business/listings/new/" className="button-primary" data-testid="link-new-listing"><Plus size={15} /> New listing</Link>}
    />
    <FlashNotice params={params} />

    <div className="bp-verification-line">
      <span>Verification</span> <StatusBadge label={verification?.label ?? active.verification_status} tone={verification?.tone ?? 'neutral'} />
      <small>{verification?.help}</small>
    </div>

    {listings.length === 0
      ? <EmptyState title="Create your first listing" action={<Link href="/business/listings/new/" className="button-primary" data-testid="link-create-first-listing">Create your first listing</Link>}>
          Listings are how travellers find you. Start with a draft: add details and photos, then submit it for review.
        </EmptyState>
      : <section className="bp-stats" aria-label="Listing summary">
          <StatCard label="Total listings" value={listings.length} href="/business/listings/" />
          <StatCard label="Published" value={count('published')} tone="good" href="/business/listings/?status=published" />
          <StatCard label="In review" value={count('pending_review')} tone="info" href="/business/listings/?status=pending_review" />
          <StatCard label="Needs attention" value={count('changes_requested', 'rejected', 'suspended')} tone={count('changes_requested', 'rejected', 'suspended') ? 'warn' : 'neutral'} hint="Changes requested, rejected or suspended" href="/business/listings/?status=attention" />
        </section>}

    <section className="bp-stats" aria-label="Visibility, last 30 days">
      <StatCard label="Listing views" value={hasEvents ? sum('view') : '–'} hint={hasEvents ? 'Last 30 days' : 'No tracked views yet'} href="/business/analytics/" />
      <StatCard label="Contact and direction clicks" value={hasEvents ? sum('contact_click', 'website_click', 'direction_click') : '–'} hint={hasEvents ? 'Last 30 days' : 'No tracked clicks yet'} href="/business/analytics/" />
      <StatCard label="New enquiries" value={enquiriesResult.count ?? 0} tone={(enquiriesResult.count ?? 0) > 0 ? 'info' : 'neutral'} href="/business/enquiries/?status=new" />
    </section>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Recent listing activity</h2>
        {(activityResult.data ?? []).length === 0
          ? <p className="bp-muted">Status changes and review decisions will appear here.</p>
          : <ul className="bp-timeline">{(activityResult.data ?? []).map((event: any) => {
              const listing = Array.isArray(event.listings) ? event.listings[0] : event.listings;
              const status = LISTING_STATUS[event.to_status];
              return <li key={event.id}>
                <Link href={`/business/listings/${event.listing_id}/edit/`}>{listing?.title ?? 'Listing'}</Link>
                <StatusBadge label={status?.label ?? event.to_status} tone={status?.tone ?? 'neutral'} />
                {event.note && <p className="bp-muted">{event.note}</p>}
                <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>;
            })}</ul>}
      </section>

      <div className="bp-stack">
        {(active.verification_status !== 'verified' || listings.length === 0) && <section className="bp-card">
          <h2 className="serif">Getting started</h2>
          <ol className="bp-steps">{steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}>
            {step.done ? <Check size={15} aria-label="Done" /> : <Circle size={15} aria-label="To do" />}
            {step.href && !step.done ? <Link href={step.href}>{step.label}</Link> : <span>{step.label}</span>}
          </li>)}</ol>
        </section>}

        {(latestEnquiries.data ?? []).length > 0 && <section className="bp-card">
          <h2 className="serif">Latest enquiries</h2>
          <ul className="bp-plain-list">{(latestEnquiries.data ?? []).map((enquiry: any) => {
            const listing = Array.isArray(enquiry.listings) ? enquiry.listings[0] : enquiry.listings;
            return <li key={enquiry.id}><strong>{enquiry.sender_name}</strong> about {listing?.title ?? 'a listing'}</li>;
          })}</ul>
          <Link href="/business/enquiries/" className="bp-link">Open inbox</Link>
        </section>}
      </div>
    </div>
  </>;
}
