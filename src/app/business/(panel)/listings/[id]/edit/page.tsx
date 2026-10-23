import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Circle, Eye } from 'lucide-react';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getBusinessContext } from '@/lib/business/context';
import { LISTING_EDITABLE, LISTING_STATUS } from '@/lib/business/constants';
import { formatDateTime } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { getListingRules } from '@/lib/listings/rules';
import { archiveListing, deleteDraftListing, restoreListing, submitListing, updateListing } from '../../actions';
import { ImageManager } from '../../ImageManager';
import { ListingForm } from '../../ListingForm';

export const metadata: Metadata = { title: 'Edit listing | Business Panel | KashiNagri', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const { supabase, active } = await getBusinessContext();
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();

  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).eq('business_id', active.id).maybeSingle();
  if (!listing) notFound();

  const [imagesResult, eventsResult, categoriesResult] = await Promise.all([
    supabase.from('listing_images').select('id, storage_path, alt_text, is_cover').eq('listing_id', id).order('sort_order').order('created_at'),
    supabase.from('listing_moderation_events').select('id, from_status, to_status, note, created_at').eq('listing_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('listing_categories').select('id, slug, name').eq('is_active', true).order('sort_order'),
  ]);

  const images = (imagesResult.data ?? []).map(image => ({
    id: image.id as string,
    alt: image.alt_text as string | null,
    is_cover: image.is_cover as boolean,
    url: supabase.storage.from('listing-images').getPublicUrl(image.storage_path).data.publicUrl,
  }));
  const events = (eventsResult.data ?? []) as { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
  const categories = (categoriesResult.data ?? []) as { id: string; slug: string; name: string }[];

  const status = LISTING_STATUS[listing.status];
  const editable = LISTING_EDITABLE.includes(listing.status);
  const submittable = ['draft', 'changes_requested', 'rejected'].includes(listing.status);
  const reviewerNote = events.find(e => e.to_status === listing.status && e.note && ['changes_requested', 'rejected', 'suspended'].includes(e.to_status));

  const rules = await getListingRules(supabase);
  const checklist = [
    { done: ['pending', 'verified'].includes(active.verification_status), label: 'Business verification requested', href: '/business/verification/' },
    { done: (listing.description ?? '').trim().length >= rules.min_description_length, label: `Description of at least ${rules.min_description_length} characters` },
    { done: Boolean((listing.area ?? '').trim()), label: 'Locality or area' },
    ...(rules.require_image ? [{ done: images.length > 0, label: 'At least one image' }] : []),
  ];
  const ready = checklist.every(item => item.done);

  return <>
    <PageHeader
      title={listing.title}
      crumbs={[{ label: 'Business', href: '/business/' }, { label: 'Listings', href: '/business/listings/' }, { label: 'Edit' }]}
      actions={<><StatusBadge label={status?.label ?? listing.status} tone={status?.tone ?? 'neutral'} />
        <Link href={`/business/listings/${listing.id}/preview/`} className="bp-btn-secondary"><Eye size={15} /> Preview</Link></>}
    />
    <FlashNotice params={query} />
    <p className="bp-muted bp-status-help">{status?.help}</p>
    {reviewerNote && <section className="bp-card bp-review-note" aria-label="Reviewer note">
      <h2 className="serif">Reviewer note</h2>
      <p>{reviewerNote.note}</p>
      <small>{formatDateTime(reviewerNote.created_at)}</small>
    </section>}

    <div className="bp-edit-grid">
      <div>
        {editable
          ? <ListingForm
              action={updateListing.bind(null, listing.id)}
              categories={categories}
              defaults={listing}
              submitLabel="Save changes"
              cancelHref="/business/listings/"
              republishWarning={listing.status === 'published'}
            />
          : <p className="bp-card bp-muted">This listing is {status?.label.toLowerCase()} and cannot be edited.</p>}
      </div>

      <aside className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Review and publishing</h2>
          {submittable && <>
            <ul className="bp-checklist">{checklist.map(item => <li key={item.label} className={item.done ? 'is-done' : ''}>
              {item.done ? <Check size={14} aria-label="Done" /> : <Circle size={14} aria-label="To do" />}
              {!item.done && item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
            </li>)}</ul>
            <form action={submitListing}>
              <input type="hidden" name="listingId" value={listing.id} />
              <SubmitButton pendingLabel="Submitting…" disabled={!ready} testId="button-submit-review">
                {listing.status === 'draft' ? 'Submit for review' : 'Resubmit for review'}
              </SubmitButton>
            </form>
            {!ready && <small className="bp-muted">Complete the checklist to submit. Save your changes first.</small>}
          </>}
          {listing.status === 'pending_review' && <p className="bp-muted">Submitted {formatDateTime(listing.submitted_at)}. You will see the decision here.</p>}
          {listing.status === 'published' && <p className="bp-muted">Live since {formatDateTime(listing.published_at)}.</p>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Photos</h2>
          <ImageManager listingId={listing.id} images={images} editable={editable} published={listing.status === 'published'} maxImages={rules.max_images} />
        </section>

        <section className="bp-card">
          <h2 className="serif">Approval history</h2>
          {events.length === 0 ? <p className="bp-muted">No activity yet.</p> : <ul className="bp-timeline">{events.map(event => {
            const s = LISTING_STATUS[event.to_status];
            return <li key={event.id}>
              <StatusBadge label={s?.label ?? event.to_status} tone={s?.tone ?? 'neutral'} />
              {event.note && <p>{event.note}</p>}
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </li>;
          })}</ul>}
        </section>

        <section className="bp-card">
          <h2 className="serif">Manage</h2>
          {listing.status === 'archived'
            ? <form action={restoreListing}><input type="hidden" name="listingId" value={listing.id} /><SubmitButton className="bp-btn-secondary" pendingLabel="Restoring…">Restore as draft</SubmitButton></form>
            : listing.status !== 'suspended' && <form action={archiveListing}>
                <input type="hidden" name="listingId" value={listing.id} />
                <ConfirmButton className="bp-btn-secondary" title="Archive this listing?" pendingLabel="Archiving…" message="It will be hidden from travellers. You can restore it later as a draft, and it will need approval again." confirmLabel="Archive" testId="button-archive">Archive listing</ConfirmButton>
              </form>}
          {listing.status === 'draft' && <form action={deleteDraftListing} className="bp-mt">
            <input type="hidden" name="listingId" value={listing.id} />
            <ConfirmButton title="Delete this draft?" pendingLabel="Deleting…" message="The draft and its photos are permanently deleted. This cannot be undone." confirmLabel="Delete draft" testId="button-delete-draft">Delete draft</ConfirmButton>
          </form>}
        </section>
      </aside>
    </div>
  </>;
}
