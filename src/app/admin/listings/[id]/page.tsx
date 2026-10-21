import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { REPORT_REASONS, REPORT_STATUS } from '@/lib/admin/constants';
import { LISTING_STATUS, PRICE_BANDS, VERIFICATION_STATUS, type BusinessHours } from '@/lib/business/constants';
import { formatDateTime, formatPrice, hoursRows } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { moderateListing, overrideListing } from '../actions';

export const metadata: Metadata = { title: 'Review listing | Admin | KashiNagri', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const ctx = await requirePermission('listings.moderate');
  const { supabase, can, isSuper, access } = ctx;
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();

  const { data: listing } = await supabase
    .from('listings')
    .select('*, listing_categories ( name ), businesses ( id, name, slug, verification_status, public_phone, public_email, area, website )')
    .eq('id', id)
    .maybeSingle();
  if (!listing) notFound();

  const [imagesResult, eventsResult, reportsResult, memberResult] = await Promise.all([
    supabase.from('listing_images').select('storage_path, alt_text, is_cover').eq('listing_id', id).order('sort_order').order('created_at'),
    supabase.from('listing_moderation_events').select('id, from_status, to_status, note, created_at').eq('listing_id', id).order('created_at', { ascending: false }),
    can('reports.review')
      ? supabase.from('content_reports').select('id, reason, details, status, created_at').eq('listing_id', id).order('created_at', { ascending: false }).limit(10)
      : null,
    listing.business_id ? supabase.from('business_members').select('user_id').eq('business_id', listing.business_id).eq('user_id', access.user.id) : null,
  ]);
  const images = (imagesResult.data ?? []).map(i => ({ url: supabase.storage.from('listing-images').getPublicUrl(i.storage_path).data.publicUrl, alt: i.alt_text ?? listing.title, cover: i.is_cover }));
  const events = (eventsResult.data ?? []) as any[];
  const reports = (reportsResult?.data ?? []) as any[];
  const isMember = (memberResult?.data ?? []).length > 0;

  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const business = one(listing.businesses) as any;
  const category = one(listing.listing_categories) as any;
  const status = listing.status as string;
  const ls = LISTING_STATUS[status];
  const vs = business ? VERIFICATION_STATUS[business.verification_status] : null;
  const businessVerified = !business || business.verification_status === 'verified';
  const canSuspend = can('listings.suspend');

  const decisions = [
    ...(status === 'pending_review' ? [
      { value: 'published', label: 'Approve and publish', disabled: !businessVerified, why: 'business not verified' },
      { value: 'changes_requested', label: 'Request corrections' },
      { value: 'rejected', label: 'Reject' },
    ] : []),
    ...(status === 'published' ? [{ value: 'suspended', label: 'Suspend (hide, keep for review)', disabled: !canSuspend, why: 'needs suspend permission' }] : []),
    ...(status === 'suspended' ? [{ value: 'published', label: 'Reinstate (publish again)', disabled: !businessVerified, why: 'business not verified' }] : []),
    ...(['published', 'suspended'].includes(status) ? [{ value: 'archived', label: 'Unpublish (archive)', disabled: !canSuspend, why: 'needs suspend permission' }] : []),
  ] as { value: string; label: string; disabled?: boolean; why?: string }[];
  const firstEnabled = decisions.find(d => !d.disabled)?.value;
  const hours = hoursRows(listing.business_hours as BusinessHours | null);
  const price = formatPrice(listing.price_from, listing.price_to, listing.price_note);
  const cover = images.find(i => i.cover) ?? images[0];

  return <>
    <PageHeader title={listing.title}
      crumbs={[{ label: 'Admin', href: '/admin/' }, { label: status === 'published' || status === 'suspended' ? 'Published listings' : 'Listing reviews', href: status === 'published' || status === 'suspended' ? '/admin/published/' : '/admin/listings/' }, { label: listing.title }]}
      actions={<><StatusBadge label={ls?.label ?? status} tone={ls?.tone ?? 'neutral'} />{status === 'published' && <Link className="bp-btn-secondary" href={`/listings/${listing.slug}/`} target="_blank">View public page</Link>}</>} />
    <FlashNotice params={query} />
    {isMember && <p className="bp-banner bp-banner-warn">You belong to this business, so you cannot moderate this listing.</p>}

    <div className="bp-edit-grid">
      <article className="bp-preview">
        {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img className="bp-preview-cover" src={cover.url} alt={cover.alt} />}
        <div className="bp-preview-body">
          <span className="eyebrow">{[category?.name, listing.subtype].filter(Boolean).join(' · ')}</span>
          {listing.summary && <p className="bp-preview-summary">{listing.summary}</p>}
          <p className="bp-preview-meta">
            {(listing.area || listing.address) && <span><MapPin size={14} /> {[listing.area, listing.address].filter(Boolean).join(', ')}</span>}
            {(price || listing.price_band) && <span>{[PRICE_BANDS.find(b => b.value === listing.price_band)?.label, price].filter(Boolean).join(' · ')}</span>}
          </p>
          {listing.description ? <p className="bp-preview-text">{listing.description}</p> : <p className="bp-muted">No description.</p>}
          {images.length > 1 && <ul className="bp-image-grid">{images.map(i => <li key={i.url}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i.url} alt={i.alt} loading="lazy" /></li>)}</ul>}
          {images.length === 0 && <p className="bp-muted">No images.</p>}
          {(listing.amenities ?? []).length > 0 && <ul className="bp-chips">{(listing.amenities as string[]).map(a => <li key={a}>{a}</li>)}</ul>}
          {hours.length > 0 && <section><h3><Clock size={14} /> Opening hours</h3><dl className="bp-hours-list">{hours.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></section>}
          {(listing.contact_phone || listing.contact_email || listing.website) && <section><h3>Contact shown publicly</h3><ul className="bp-plain-list">
            {listing.contact_phone && <li><Phone size={14} /> {listing.contact_phone}</li>}
            {listing.contact_email && <li><Mail size={14} /> {listing.contact_email}</li>}
            {listing.website && <li><Globe size={14} /> {listing.website}</li>}
          </ul></section>}
          <p className="bp-muted">Submitted {formatDateTime(listing.submitted_at)} · Last updated {formatDateTime(listing.updated_at)}</p>
        </div>
      </article>

      <aside className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Decision</h2>
          {isMember ? <p className="bp-muted">Another admin must decide.</p> : decisions.length === 0
            ? <p className="bp-muted">No moderation decision applies while the listing is {ls?.label.toLowerCase() ?? status}. {status === 'changes_requested' || status === 'rejected' ? 'It is waiting for the business to resubmit.' : ''}</p>
            : <form action={moderateListing} className="bp-form">
                <input type="hidden" name="listingId" value={id} />
                <div className="bp-field">
                  <label htmlFor="decision">Decision</label>
                  <select id="decision" name="decision" defaultValue={firstEnabled} data-testid="select-listing-decision">
                    {decisions.map(d => <option key={d.value} value={d.value} disabled={d.disabled}>{d.label}{d.disabled ? ` (${d.why})` : ''}</option>)}
                  </select>
                </div>
                <div className="bp-field">
                  <label htmlFor="note">Reason / note for the business</label>
                  <textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Required for every decision except approval" data-testid="input-listing-note" />
                </div>
                <ConfirmButton className="button-primary" title="Record this decision?" message="The listing status changes immediately and public visibility follows. The decision is recorded with your name, the time and your note." confirmLabel="Record decision" testId="button-record-listing-decision">Record decision</ConfirmButton>
              </form>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Business</h2>
          {business ? <>
            <p><strong>{business.name}</strong> <StatusBadge label={vs?.label ?? business.verification_status} tone={vs?.tone ?? 'neutral'} /></p>
            <dl className="bp-readonly cc-dl">
              <div><dt>Locality</dt><dd>{business.area || '–'}</dd></div>
              <div><dt>Public phone</dt><dd>{business.public_phone || '–'}</dd></div>
              <div><dt>Public email</dt><dd>{business.public_email || '–'}</dd></div>
            </dl>
            {!businessVerified && <p className="bp-muted">Listings cannot go public until the business is verified.</p>}
            {can('businesses.verify') && <Link className="bp-link" href={`/admin/verifications/${business.id}/`}>Open verification record</Link>}
          </> : <p className="bp-muted">KashiNagri curated listing (no business).</p>}
        </section>

        {reportsResult && <section className="bp-card">
          <h2 className="serif">Reports ({reports.length})</h2>
          {reports.length === 0 ? <p className="bp-muted">No reports about this listing.</p> : <ul className="bp-plain-list">{reports.map(r => {
            const rs = REPORT_STATUS[r.status];
            return <li key={r.id}><StatusBadge label={rs?.label ?? r.status} tone={rs?.tone ?? 'neutral'} /> {REPORT_REASONS[r.reason] ?? r.reason}</li>;
          })}</ul>}
          {reports.length > 0 && <Link className="bp-link" href={`/admin/reports/?listing=${id}&status=all`}>Open in report queue</Link>}
        </section>}

        <section className="bp-card">
          <h2 className="serif">Approval history</h2>
          {events.length === 0 ? <p className="bp-muted">No history.</p> : <ul className="bp-timeline">{events.map(e => {
            const es = LISTING_STATUS[e.to_status];
            return <li key={e.id}><StatusBadge label={es?.label ?? e.to_status} tone={es?.tone ?? 'neutral'} />{e.note && <p>{e.note}</p>}<time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time></li>;
          })}</ul>}
        </section>

        {isSuper && !isMember && <section className="bp-card cc-danger-zone">
          <h2 className="serif">Super admin override</h2>
          <p className="bp-muted">Use only to correct a wrong decision. Bypasses the normal workflow (but never publishes a listing whose business is unverified). Requires a reason and is audited.</p>
          <form action={overrideListing} className="bp-form">
            <input type="hidden" name="listingId" value={id} />
            <div className="bp-field">
              <label htmlFor="override-status">Set status to</label>
              <select id="override-status" name="status" defaultValue="" data-testid="select-override-status">
                <option value="" disabled>Choose…</option>
                {Object.entries(LISTING_STATUS).filter(([v]) => v !== status).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div className="bp-field"><label htmlFor="override-reason">Reason (at least 10 characters)</label><textarea id="override-reason" name="reason" rows={2} maxLength={1000} data-testid="input-override-reason" /></div>
            <ConfirmButton className="bp-btn-danger" title="Apply override?" message="This bypasses the normal moderation workflow. It is recorded in the audit log with your reason." confirmLabel="Apply override" testId="button-apply-override">Apply override</ConfirmButton>
          </form>
        </section>}
      </aside>
    </div>
  </>;
}
