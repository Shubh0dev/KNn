import Link from 'next/link';
import { EmptyState, FlashNotice, PageHeader, StatCard, StatusBadge } from '@/components/business/ui';
import { getStaffContext } from '@/lib/admin/context';
import { permissionLabel } from '@/lib/admin/constants';
import { LISTING_STATUS, VERIFICATION_STATUS } from '@/lib/business/constants';
import { formatDateTime } from '@/lib/business/format';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, can, permissions, isSuper } = await getStaffContext();
  const params = await searchParams;
  const head = { count: 'exact' as const, head: true };

  const [pendingBiz, pendingListings, published, attention, openReports, listingEvents, bizEvents] = await Promise.all([
    can('businesses.verify') ? supabase.from('businesses').select('id', head).eq('verification_status', 'pending') : null,
    can('listings.moderate') ? supabase.from('listings').select('id', head).eq('status', 'pending_review') : null,
    can('listings.moderate') ? supabase.from('listings').select('id', head).eq('status', 'published') : null,
    can('listings.moderate') ? supabase.from('listings').select('id', head).in('status', ['changes_requested', 'rejected']) : null,
    can('reports.review') ? supabase.from('content_reports').select('id', head).in('status', ['open', 'reviewing']) : null,
    can('listings.moderate')
      ? supabase.from('listing_moderation_events').select('id, listing_id, from_status, to_status, note, created_at, listings ( title )').order('created_at', { ascending: false }).limit(8)
      : null,
    can('businesses.verify')
      ? supabase.from('business_verification_events').select('id, business_id, to_status, note, created_at, businesses ( name )').order('created_at', { ascending: false }).limit(6)
      : null,
  ]);

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v);
  const noAccess = !can('businesses.verify') && !can('listings.moderate') && !can('reports.review');

  return <>
    <PageHeader title="Operations" crumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} lede="Work that is waiting for a decision, and what changed recently." />
    <FlashNotice params={params} />

    {noAccess
      ? <EmptyState title="No permissions yet">Your admin account has no moderation permissions. A super admin can grant them from the Admin management page.</EmptyState>
      : <section className="bp-stats" aria-label="Queues">
          {pendingBiz && <StatCard label="Pending business verifications" value={pendingBiz.count ?? 0} tone={(pendingBiz.count ?? 0) ? 'info' : 'neutral'} href="/admin/verifications/" />}
          {pendingListings && <StatCard label="Listings awaiting review" value={pendingListings.count ?? 0} tone={(pendingListings.count ?? 0) ? 'info' : 'neutral'} href="/admin/listings/" />}
          {published && <StatCard label="Published listings" value={published.count ?? 0} tone="good" href="/admin/published/" />}
          {attention && <StatCard label="Rejected or changes requested" value={attention.count ?? 0} hint="Waiting on the business" href="/admin/listings/?status=attention" />}
          {openReports && <StatCard label="Open content reports" value={openReports.count ?? 0} tone={(openReports.count ?? 0) ? 'warn' : 'neutral'} href="/admin/reports/" />}
        </section>}

    <div className="bp-two-col">
      <div className="bp-stack">
        {listingEvents && <section className="bp-card">
          <h2 className="serif">Recent listing decisions</h2>
          {(listingEvents.data ?? []).length === 0 ? <p className="bp-muted">No listing activity yet.</p> : <ul className="bp-timeline">{(listingEvents.data ?? []).map((e: any) => {
            const s = LISTING_STATUS[e.to_status];
            return <li key={e.id}>
              <Link href={`/admin/listings/${e.listing_id}/`}>{one(e.listings)?.title ?? 'Listing'}</Link>
              <StatusBadge label={s?.label ?? e.to_status} tone={s?.tone ?? 'neutral'} />
              {e.note && <p className="bp-muted">{e.note}</p>}
              <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
            </li>;
          })}</ul>}
        </section>}
        {bizEvents && <section className="bp-card">
          <h2 className="serif">Recent verification activity</h2>
          {(bizEvents.data ?? []).length === 0 ? <p className="bp-muted">No verification activity yet.</p> : <ul className="bp-timeline">{(bizEvents.data ?? []).map((e: any) => {
            const s = VERIFICATION_STATUS[e.to_status];
            return <li key={e.id}>
              <Link href={`/admin/verifications/${e.business_id}/`}>{one(e.businesses)?.name ?? 'Business'}</Link>
              <StatusBadge label={s?.label ?? e.to_status} tone={s?.tone ?? 'neutral'} />
              {e.note && <p className="bp-muted">{e.note}</p>}
              <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
            </li>;
          })}</ul>}
        </section>}
      </div>
      <section className="bp-card">
        <h2 className="serif">Your permissions</h2>
        {isSuper ? <p className="bp-muted">Super admins hold every permission.</p> : permissions.length === 0
          ? <p className="bp-muted">None yet.</p>
          : <ul className="bp-plain-list">{permissions.map(p => <li key={p}>✓ {permissionLabel(p)}</li>)}</ul>}
        <p className="bp-muted">Admins cannot change roles, grant permissions, read the audit log without permission, or change platform settings.</p>
      </section>
    </div>
  </>;
}
