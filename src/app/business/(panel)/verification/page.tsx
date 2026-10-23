import type { Metadata } from 'next';
import { FileText, Lock } from 'lucide-react';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { documentTypeLabel, VERIFICATION_STATUS, type Tone } from '@/lib/business/constants';
import { formatDate, formatDateTime } from '@/lib/business/format';
import { DocumentUploader } from './DocumentUploader';
import { removeVerificationDocument, requestVerification } from './actions';

export const metadata: Metadata = { title: 'Verification | Business Panel | KashiNagri', robots: { index: false } };

const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting review', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'good' },
  rejected: { label: 'Not accepted', tone: 'bad' },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, active } = await getBusinessContext();
  const params = await searchParams;

  const [docsResult, eventsResult] = await Promise.all([
    supabase.from('business_verification_documents')
      .select('id, document_type, review_status, review_note, created_at')
      .eq('business_id', active.id).order('created_at', { ascending: false }),
    supabase.from('business_verification_events')
      .select('id, to_status, note, created_at')
      .eq('business_id', active.id).order('created_at', { ascending: false }).limit(20),
  ]);
  const docs = (docsResult.data ?? []) as { id: string; document_type: string; review_status: string; review_note: string | null; created_at: string }[];
  const events = (eventsResult.data ?? []) as { id: number; to_status: string; note: string | null; created_at: string }[];

  const isOwner = active.member_role === 'owner';
  const status = VERIFICATION_STATUS[active.verification_status];
  const canUpload = isOwner && ['unverified', 'rejected', 'pending', 'changes_requested'].includes(active.verification_status);
  const canRequest = isOwner && ['unverified', 'rejected', 'changes_requested'].includes(active.verification_status);
  const decisionNote = events.find(e => e.to_status === active.verification_status && e.note);

  return <>
    <PageHeader
      title="Verification"
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Verification' }]}
      lede="Verification shows travellers that your business is real. Our team reviews every request; completing this page does not verify you automatically."
    />
    <FlashNotice params={params} />

    <section className="bp-card">
      <div className="bp-verification-line">
        <StatusBadge label={status?.label ?? active.verification_status} tone={status?.tone ?? 'neutral'} />
        <small>{status?.help}</small>
      </div>
      {decisionNote && <p className="bp-review-note-inline"><strong>Note from our team:</strong> {decisionNote.note}</p>}
      <ol className="bp-steps bp-steps-plain">
        <li className={docs.length ? 'is-done' : ''}>Upload at least one document that shows who runs the business.</li>
        <li className={!['unverified', 'rejected', 'changes_requested'].includes(active.verification_status) ? 'is-done' : ''}>Request verification.</li>
        <li className={active.verification_status === 'verified' ? 'is-done' : ''}>Our team reviews it. You will see the result on this page.</li>
      </ol>
    </section>

    <div className="bp-two-col">
      <section className="bp-card">
        <h2 className="serif">Your documents <span className="bp-tag bp-tag-private"><Lock size={11} /> Private</span></h2>
        <p className="bp-muted">Documents are stored privately. They are never shown on your listing and are visible only to you and the KashiNagri verification team. Send only what is needed, and cover any numbers you do not want us to see.</p>
        {docs.length === 0
          ? <p className="bp-muted">No documents uploaded yet.</p>
          : <ul className="bp-docs">{docs.map(doc => {
              const s = DOC_STATUS[doc.review_status];
              return <li key={doc.id}>
                <FileText size={16} />
                <div>
                  <a href={`/business/verification/document/${doc.id}/`} target="_blank" rel="noopener noreferrer">{documentTypeLabel(doc.document_type)}</a>
                  <small>Uploaded {formatDate(doc.created_at)}</small>
                  {doc.review_note && <small className="bp-field-error">{doc.review_note}</small>}
                </div>
                <StatusBadge label={s?.label ?? doc.review_status} tone={s?.tone ?? 'neutral'} />
                {isOwner && doc.review_status === 'pending' && <form action={removeVerificationDocument}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <ConfirmButton className="bp-btn-link-danger" title="Remove this document?" pendingLabel="Removing…" message="The file is permanently deleted from private storage." confirmLabel="Remove" testId="button-remove-document">Remove</ConfirmButton>
                </form>}
              </li>;
            })}</ul>}
        {canUpload && <DocumentUploader businessId={active.id} />}
        {!isOwner && <p className="bp-muted">Only the business owner can upload documents.</p>}
      </section>

      <div className="bp-stack">
        {canRequest && <section className="bp-card">
          <h2 className="serif">Request verification</h2>
          <p className="bp-muted">{docs.length ? 'Ready? Send your documents to our team for review.' : 'Upload at least one document first.'}</p>
          <form action={requestVerification}>
            <SubmitButton pendingLabel="Requesting…" disabled={docs.length === 0} testId="button-request-verification">Request verification</SubmitButton>
          </form>
        </section>}

        <section className="bp-card">
          <h2 className="serif">History</h2>
          {events.length === 0 ? <p className="bp-muted">No activity yet.</p> : <ul className="bp-timeline">{events.map(event => {
            const s = VERIFICATION_STATUS[event.to_status];
            return <li key={event.id}>
              <StatusBadge label={s?.label ?? event.to_status} tone={s?.tone ?? 'neutral'} />
              {event.note && <p>{event.note}</p>}
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </li>;
          })}</ul>}
        </section>
      </div>
    </div>
  </>;
}
