import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { LISTING_STATUS } from '@/lib/business/constants';
import { formatDateTime } from '@/lib/business/format';
import { isUuid } from '@/lib/business/state';
import { getListingRules } from '@/lib/listings/rules';
import { ImageManager } from '@/app/business/(panel)/listings/ImageManager';
import { ListingForm } from '@/app/business/(panel)/listings/ListingForm';
import {
  curatedMoveImage, curatedRegisterImage, curatedRemoveImage, curatedSetCover, deleteCurated, setCuratedStatus, updateCurated,
} from '../../actions';

export const metadata: Metadata = { title: 'Edit curated place | Super Admin | KashiNagri', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const { supabase } = await getSuperContext();
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).is('business_id', null).maybeSingle();
  if (!listing) notFound();

  const [imagesResult, categoriesResult, eventsResult, rules] = await Promise.all([
    supabase.from('listing_images').select('id, storage_path, alt_text, is_cover').eq('listing_id', id).order('sort_order').order('created_at'),
    supabase.from('listing_categories').select('id, slug, name').order('sort_order'),
    supabase.from('listing_moderation_events').select('id, to_status, note, created_at').eq('listing_id', id).order('created_at', { ascending: false }).limit(20),
    getListingRules(supabase),
  ]);
  const images = (imagesResult.data ?? []).map(i => ({ id: i.id as string, alt: i.alt_text as string | null, is_cover: i.is_cover as boolean, url: supabase.storage.from('listing-images').getPublicUrl(i.storage_path).data.publicUrl }));
  const status = listing.status as string;
  const s = LISTING_STATUS[status];
  const editable = status !== 'archived';
  const next = status === 'published' ? [{ v: 'draft', l: 'Unpublish (back to draft)' }, { v: 'archived', l: 'Archive' }]
    : status === 'archived' ? [{ v: 'draft', l: 'Restore as draft' }]
    : [{ v: 'published', l: 'Publish' }, { v: 'archived', l: 'Archive' }];

  return <>
    <PageHeader title={listing.title} crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Website content', href: '/superadmin/content/' }, { label: listing.title }]}
      actions={<><StatusBadge label={s?.label ?? status} tone={s?.tone ?? 'neutral'} />{status === 'published' && <Link className="bp-btn-secondary" href={`/listings/${listing.slug}/`} target="_blank">View public page</Link>}</>} />
    <FlashNotice params={query} />
    <div className="bp-edit-grid">
      <div>{editable
        ? <ListingForm action={updateCurated.bind(null, id)} categories={(categoriesResult.data ?? []) as any} defaults={listing} submitLabel="Save changes" cancelHref="/superadmin/content/" />
        : <p className="bp-card bp-muted">Archived. Restore it as a draft to edit.</p>}</div>
      <aside className="bp-stack">
        <section className="bp-card">
          <h2 className="serif">Publishing</h2>
          <p className="bp-muted">Curated content is written by KashiNagri, so it does not go through business review. Publishing needs a description of at least 30 characters.</p>
          <div className="cc-button-row">{next.map(n => <form action={setCuratedStatus} key={n.v}>
            <input type="hidden" name="listingId" value={id} /><input type="hidden" name="status" value={n.v} />
            <SubmitButton className={n.v === 'published' ? 'button-primary' : 'bp-btn-secondary'} pendingLabel="…" testId={`button-curated-${n.v}`}>{n.l}</SubmitButton>
          </form>)}</div>
          {['draft', 'archived'].includes(status) && <form action={deleteCurated} className="bp-mt">
            <input type="hidden" name="listingId" value={id} />
            <ConfirmButton title="Delete this curated place?" pendingLabel="Deleting…" message="It and its photos are permanently deleted." confirmLabel="Delete" testId="button-delete-curated">Delete</ConfirmButton>
          </form>}
        </section>
        <section className="bp-card">
          <h2 className="serif">Photos</h2>
          <ImageManager listingId={id} images={images} editable={editable} published={status === 'published'} reviewNotice={false} maxImages={rules.max_images}
            actions={{ register: curatedRegisterImage, remove: curatedRemoveImage, setCover: curatedSetCover, move: curatedMoveImage }} />
        </section>
        <section className="bp-card">
          <h2 className="serif">History</h2>
          <ul className="bp-timeline">{(eventsResult.data ?? []).map((e: any) => <li key={e.id}><StatusBadge label={LISTING_STATUS[e.to_status]?.label ?? e.to_status} tone={LISTING_STATUS[e.to_status]?.tone ?? 'neutral'} /><time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time></li>)}</ul>
        </section>
      </aside>
    </div>
  </>;
}
