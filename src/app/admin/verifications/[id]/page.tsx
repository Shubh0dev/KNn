import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Circle, FileText, Lock } from 'lucide-react';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { requirePermission } from '@/lib/admin/context';
import { businessTypeLabel, documentTypeLabel, LISTING_STATUS, VERIFICATION_STATUS, type Tone } from '@/lib/business/constants';
import { formatDate, formatDateTime } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { decideVerification, reviewDocument } from '../actions';

export const metadata: Metadata = { title: 'Review business | Admin | KashiNagri', robots: { index: false } };

const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'To review', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'good' },
  rejected: { label: 'Not accepted', tone: 'bad' },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const { supabase, can, access } = await requirePermission('businesses.verify');
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();

  const { data: business } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle();
  if (!business) notFound();

  const [privateResult, docsResult, eventsResult, membersResult, listingsResult] = await Promise.all([
    supabase.from('business_private_details').select('*').eq('business_id', id).maybeSingle(),
    supabase.from('business_verification_documents').select('id, document_type, review_status, review_note, created_at, reviewed_at').eq('business_id', id).order('created_at'),
    supabase.from('business_verification_events').select('id, from_status, to_status, note, created_at, actor_id').eq('business_id', id).order('created_at', { ascending: false }),
    supabase.from('business_members').select('user_id, member_role, created_at').eq('business_id', id),
    supabase.from('listings').select('id, title, status').eq('business_id', id).order('updated_at', { ascending: false }),
  ]);
  const details = privateResult.data;
  const docs = (docsResult.data ?? []) as any[];
  const events = (eventsResult.data ?? []) as any[];
  const members = (membersResult.data ?? []) as any[];
  const listings = (listingsResult.data ?? []) as any[];

  // Owner identity is personal data: shown only to admins who hold users.view.
  let owners: { email: string | null; full_name: string | null; member_role: string }[] = [];
  if (can('users.view') && members.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', members.map(m => m.user_id));
    owners = members.map(m => ({ ...(profiles ?? []).find(p => p.id === m.user_id), member_role: m.member_role })) as any;
  }
  const isMember = members.some(m => m.user_id === access.user.id);

  const status = business.verification_status as string;
  const s = VERIFICATION_STATUS[status];
  const pendingDocs = docs.filter(d => d.review_status === 'pending').length;
  const acceptedDocs = docs.filter(d => d.review_status === 'accepted').length;
  const readiness = [
    { done: Boolean(business.business_type), label: 'Business type set' },
    { done: Boolean((business.area ?? '').trim()), label: 'Locality set' },
    { done: pendingDocs === 0 && docs.length > 0, label: 'Every document reviewed' },
    { done: acceptedDocs > 0, label: 'At least one document accepted' },
  ];
  const canVerify = ['pending', 'suspended'].includes(status) && readiness.every(r => r.done);
  const decisions = [
    ...(['pending', 'suspended'].includes(status) ? [{ value: 'verified', label: status === 'suspended' ? 'Reinstate (verified)' : 'Verify business', disabled: !canVerify }] : []),
    ...(status === 'pending' ? [{ value: 'changes_requested', label: 'Request corrections' }, { value: 'rejected', label: 'Reject' }] : []),
    ...(['verified', 'pending'].includes(status) ? [{ value: 'suspended', label: 'Suspend business' }] : []),
  ] as { value: string; label: string; disabled?: boolean }[];

  return <>
    <PageHeader title={business.name} crumbs={[{ label: 'Admin', href: '/admin/' }, { label: 'Verifications', href: '/admin/verifications/' }, { label: business.name }]}
      actions={<StatusBadge label={s?.label ?? status} tone={s?.tone ?? 'neutral'} />} />
    <FlashNotice params={query} />
    {isMember && <p className="bp-banner bp-banner-warn">You belong to this business, so you cannot make decisions about it.</p>}

    <div className="bp-edit-grid">
      <div className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Business profile <span className="bp-tag bp-tag-public">Public</span></h2>
          <dl className="bp-readonly cc-dl">
            <div><dt>Type</dt><dd>{businessTypeLabel(business.business_type)}</dd></div>
            <div><dt>Locality</dt><dd>{business.area || '–'}</dd></div>
            <div><dt>Address</dt><dd>{business.address || '–'}</dd></div>
            <div><dt>Public phone</dt><dd>{business.public_phone || '–'}</dd></div>
            <div><dt>Public email</dt><dd>{business.public_email || '–'}</dd></div>
            <div><dt>Website</dt><dd>{business.website || '–'}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(business.created_at)}</dd></div>
          </dl>
          {business.description && <p>{business.description}</p>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Private details <span className="bp-tag bp-tag-private"><Lock size={11} /> Private</span></h2>
          <dl className="bp-readonly cc-dl">
            <div><dt>Legal name</dt><dd>{details?.legal_name || '–'}</dd></div>
            <div><dt>Registration no.</dt><dd>{details?.registration_number || '–'}</dd></div>
            <div><dt>GST</dt><dd>{details?.gst_number || '–'}</dd></div>
            <div><dt>Contact email</dt><dd>{details?.contact_email || '–'}</dd></div>
            <div><dt>Contact phone</dt><dd>{details?.contact_phone || '–'}</dd></div>
            <div><dt>Registered address</dt><dd>{details?.registered_address || '–'}</dd></div>
          </dl>
          {can('users.view')
            ? owners.length > 0 && <p className="bp-muted">Team: {owners.map(o => `${o.full_name ?? ''} <${o.email ?? '?'}> (${o.member_role})`).join(', ')}</p>
            : <p className="bp-muted">Account owner details are hidden (requires the "View account profiles" permission).</p>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Verification documents</h2>
          {docs.length === 0 ? <p className="bp-muted">No documents uploaded.</p> : <ul className="bp-docs">{docs.map(doc => {
            const ds = DOC_STATUS[doc.review_status];
            return <li key={doc.id}>
              <FileText size={16} />
              <div>
                <a href={`/admin/verifications/document/${doc.id}/`} target="_blank" rel="noopener noreferrer" data-testid="link-open-document">{documentTypeLabel(doc.document_type)}</a>
                <small>Uploaded {formatDate(doc.created_at)}{doc.reviewed_at ? ` · reviewed ${formatDate(doc.reviewed_at)}` : ''}</small>
                {doc.review_note && <small>Note: {doc.review_note}</small>}
              </div>
              <StatusBadge label={ds?.label ?? doc.review_status} tone={ds?.tone ?? 'neutral'} />
              {doc.review_status === 'pending' && !isMember && <form action={reviewDocument} className="cc-inline-form">
                <input type="hidden" name="businessId" value={id} />
                <input type="hidden" name="documentId" value={doc.id} />
                <input name="note" placeholder="Note (required to reject)" aria-label="Review note" maxLength={1000} />
                <SubmitButton name="decision" value="accepted" className="bp-btn-secondary bp-btn-small" pendingLabel="Accepting…" testId="button-accept-document">Accept</SubmitButton>
                <SubmitButton name="decision" value="rejected" className="bp-btn-danger bp-btn-small" pendingLabel="Saving…" testId="button-reject-document">Not accepted</SubmitButton>
              </form>}
            </li>;
          })}</ul>}
          <p className="bp-muted">Documents open through a link that expires after 60 seconds. They are never public.</p>
        </section>
      </div>

      <aside className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Decision</h2>
          {decisions.length === 0 || isMember
            ? <p className="bp-muted">{isMember ? 'Another admin must decide.' : `No decision is available while the business is ${s?.label.toLowerCase() ?? status}.`}</p>
            : <>
                {['pending', 'suspended'].includes(status) && <ul className="bp-checklist">{readiness.map(r => <li key={r.label} className={r.done ? 'is-done' : ''}>
                  {r.done ? <Check size={14} aria-label="Done" /> : <Circle size={14} aria-label="Missing" />}{r.label}</li>)}</ul>}
                <form action={decideVerification} className="bp-form">
                  <input type="hidden" name="businessId" value={id} />
                  <div className="bp-field">
                    <label htmlFor="decision">Decision</label>
                    <select id="decision" name="decision" defaultValue={decisions.find(d => !d.disabled)?.value} data-testid="select-verification-decision">
                      {decisions.map(d => <option key={d.value} value={d.value} disabled={d.disabled}>{d.label}{d.disabled ? ' (checklist incomplete)' : ''}</option>)}
                    </select>
                  </div>
                  <div className="bp-field">
                    <label htmlFor="note">Reason / note for the business</label>
                    <textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Required for corrections, rejection and suspension" data-testid="input-decision-note" />
                  </div>
                  <ConfirmButton className="button-primary" title="Record this decision?" pendingLabel="Recording decision…" message="The business will see the outcome and your note. The decision is recorded in the audit log with your name." confirmLabel="Record decision" testId="button-record-decision">Record decision</ConfirmButton>
                </form>
              </>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Listings ({listings.length})</h2>
          {listings.length === 0 ? <p className="bp-muted">No listings yet.</p> : <ul className="bp-plain-list">{listings.slice(0, 10).map(l => {
            const ls = LISTING_STATUS[l.status];
            return <li key={l.id}><Link href={`/admin/listings/${l.id}/`}>{l.title}</Link> <StatusBadge label={ls?.label ?? l.status} tone={ls?.tone ?? 'neutral'} /></li>;
          })}</ul>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Decision history</h2>
          {events.length === 0 ? <p className="bp-muted">No history.</p> : <ul className="bp-timeline">{events.map(e => {
            const es = VERIFICATION_STATUS[e.to_status];
            return <li key={e.id}><StatusBadge label={es?.label ?? e.to_status} tone={es?.tone ?? 'neutral'} />{e.note && <p>{e.note}</p>}<time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time></li>;
          })}</ul>}
        </section>
      </aside>
    </div>
  </>;
}
