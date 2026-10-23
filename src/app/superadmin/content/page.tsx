import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ConfirmButton } from '@/components/business/ConfirmButton';
import { SubmitButton } from '@/components/business/SubmitButton';
import { EmptyState, FlashNotice, PageHeader, StatusBadge } from '@/components/business/ui';
import { getSuperContext } from '@/lib/admin/context';
import { LISTING_STATUS } from '@/lib/business/constants';
import { formatDate } from '@/lib/business/format';
import { addPlacement, createCategory, removePlacement, saveCategory, updatePlacement } from './actions';

export const metadata: Metadata = { title: 'Website content | Super Admin | KashiNagri', robots: { index: false } };

const TABS = [
  { key: 'curated', label: 'Curated places' },
  { key: 'featured', label: 'Featured & sponsored' },
  { key: 'categories', label: 'Categories' },
];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await getSuperContext();
  const params = await searchParams;
  const tab = TABS.some(t => t.key === params.tab) ? String(params.tab) : 'curated';
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return <>
    <PageHeader title="Website content" crumbs={[{ label: 'Super Admin', href: '/superadmin/' }, { label: 'Website content' }]}
      lede="Content stored in Supabase and shown on the public site: curated places (temples, ghats, food, events, guides…), homepage features and the category list. Pages refresh within minutes of a change." />
    <FlashNotice params={params} />
    <nav className="bp-segment cc-tabs" aria-label="Content sections">{TABS.map(t => <Link key={t.key} href={`/superadmin/content/?tab=${t.key}`} className={t.key === tab ? 'is-active' : ''} aria-current={t.key === tab ? 'page' : undefined}>{t.label}</Link>)}</nav>

    {tab === 'curated' && await (async () => {
      const { data } = await supabase.from('listings')
        .select('id, title, slug, status, area, updated_at, listing_categories ( name )')
        .is('business_id', null).order('updated_at', { ascending: false }).limit(200);
      const rows = (data ?? []) as any[];
      return <section>
        <div className="cc-section-head">
          <p className="bp-muted">Platform-written places and guides (no business owner). Published ones appear in their category on the public site with a "KashiNagri curated" label.</p>
          <Link href="/superadmin/content/curated/new/" className="button-primary" data-testid="link-new-curated"><Plus size={15} /> New curated place</Link>
        </div>
        {rows.length === 0 ? <EmptyState title="No curated places yet">Create one to add a temple, ghat, food spot, guide or event to the public directory.</EmptyState> : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Updated</th><th><span className="sr-only">Edit</span></th></tr></thead>
          <tbody>{rows.map(r => {
            const s = LISTING_STATUS[r.status];
            return <tr key={r.id}>
              <td data-label="Title"><Link className="bp-row-title" href={`/superadmin/content/curated/${r.id}/`}>{r.title}</Link><small>{r.area}</small></td>
              <td data-label="Category">{one(r.listing_categories)?.name ?? '–'}</td>
              <td data-label="Status"><StatusBadge label={s?.label ?? r.status} tone={s?.tone ?? 'neutral'} /></td>
              <td data-label="Updated">{formatDate(r.updated_at)}</td>
              <td className="bp-row-actions"><Link href={`/superadmin/content/curated/${r.id}/`}>Edit</Link>{r.status === 'published' && <Link href={`/listings/${r.slug}/`}>View</Link>}</td>
            </tr>;
          })}</tbody>
        </table></div>}
      </section>;
    })()}

    {tab === 'featured' && await (async () => {
      const [placementsResult, publishedResult, settingResult] = await Promise.all([
        supabase.from('featured_placements').select('id, placement, sort_order, is_sponsored, starts_at, ends_at, listing_id, listings ( title, status, slug )').order('placement').order('sort_order'),
        supabase.from('listings').select('id, title').eq('status', 'published').order('title').limit(300),
        supabase.from('platform_settings').select('value').eq('key', 'sponsored_placements').maybeSingle(),
      ]);
      const placements = (placementsResult.data ?? []) as any[];
      const sponsored = (settingResult.data?.value ?? {}) as { enabled?: boolean; label?: string; max_home_slots?: number };
      return <section className="bp-stack">
        <p className="bp-muted">Featured listings appear on the homepage (or at the top of their category page). Only published listings can be featured. Sponsored placements are {sponsored.enabled ? <strong>enabled</strong> : <strong>switched off</strong>} in <Link href="/superadmin/settings/">settings</Link>{sponsored.enabled ? ` and are labelled "${sponsored.label}" publicly` : ''}. No payment is taken here.</p>
        <section className="bp-card">
          <h2 className="serif">Add a placement</h2>
          {(publishedResult.data ?? []).length === 0 ? <p className="bp-muted">There are no published listings to feature yet.</p> : <form action={addPlacement} className="cc-inline-form cc-wrap-form">
            <select name="listingId" aria-label="Listing" required data-testid="select-feature-listing">{(publishedResult.data ?? []).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
            <select name="placement" aria-label="Placement" defaultValue="home"><option value="home">Homepage</option><option value="category">Top of its category</option></select>
            <label className="cc-mini-field">Order <input name="sort_order" type="number" min={0} max={1000} defaultValue={0} /></label>
            <label className="cc-mini-field">From <input name="starts_at" type="date" /></label>
            <label className="cc-mini-field">Until <input name="ends_at" type="date" /></label>
            <label className="bp-check"><input type="checkbox" name="is_sponsored" disabled={!sponsored.enabled} /> Sponsored</label>
            <SubmitButton className="bp-btn-secondary" pendingLabel="Adding…" testId="button-add-placement">Add</SubmitButton>
          </form>}
        </section>
        {placements.length === 0 ? <EmptyState title="Nothing is featured">The homepage shows only the built-in sections until something is featured.</EmptyState> : <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Listing</th><th>Where</th><th>Window</th><th>Order &amp; sponsorship</th><th><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>{placements.map(p => {
            const l = one(p.listings);
            return <tr key={p.id}>
              <td data-label="Listing">{l?.title ?? '–'} {l && l.status !== 'published' && <StatusBadge label="Not public" tone="warn" />}</td>
              <td data-label="Where">{p.placement === 'home' ? 'Homepage' : 'Category'}</td>
              <td data-label="Window">{p.starts_at ? formatDate(p.starts_at) : 'Now'} – {p.ends_at ? formatDate(p.ends_at) : 'open-ended'}</td>
              <td data-label="Order"><form action={updatePlacement} className="cc-inline-form">
                <input type="hidden" name="id" value={p.id} />
                <input name="sort_order" type="number" min={0} max={1000} defaultValue={p.sort_order} aria-label="Order" className="cc-num" />
                <label className="bp-check"><input type="checkbox" name="is_sponsored" defaultChecked={p.is_sponsored} disabled={!sponsored.enabled && !p.is_sponsored} /> Sponsored</label>
                <SubmitButton className="bp-btn-secondary bp-btn-small" pendingLabel="…">Save</SubmitButton>
              </form></td>
              <td className="bp-row-actions"><form action={removePlacement}><input type="hidden" name="id" value={p.id} /><ConfirmButton className="bp-btn-link-danger" title="Remove this placement?" pendingLabel="Removing…" message="The listing stays published; it just stops being featured." confirmLabel="Remove" testId="button-remove-placement">Remove</ConfirmButton></form></td>
            </tr>;
          })}</tbody>
        </table></div>}
      </section>;
    })()}

    {tab === 'categories' && await (async () => {
      const { data } = await supabase.from('listing_categories').select('id, slug, name, description, sort_order, is_active').order('sort_order');
      return <section className="bp-stack">
        <p className="bp-muted">Categories group listings on the public site (stays, food, temples, ghats, events…). Hide a category instead of deleting it; listings keep their category.</p>
        <div className="bp-table-wrap"><table className="bp-table">
          <thead><tr><th>Slug</th><th>Name, description, order, visibility</th></tr></thead>
          <tbody>{(data ?? []).map(c => <tr key={c.id}>
            <td data-label="Slug"><code>{c.slug}</code></td>
            <td><form action={saveCategory} className="cc-inline-form cc-wrap-form">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} aria-label="Name" maxLength={80} required />
              <input name="description" defaultValue={c.description ?? ''} aria-label="Description" maxLength={500} className="cc-wide-input" />
              <input name="sort_order" type="number" defaultValue={c.sort_order} aria-label="Order" className="cc-num" />
              <label className="bp-check"><input type="checkbox" name="is_active" defaultChecked={c.is_active} /> Visible</label>
              <SubmitButton className="bp-btn-secondary bp-btn-small" pendingLabel="…" testId={`button-save-category-${c.slug}`}>Save</SubmitButton>
            </form></td>
          </tr>)}</tbody>
        </table></div>
        <section className="bp-card">
          <h2 className="serif">New category</h2>
          <form action={createCategory} className="cc-inline-form cc-wrap-form">
            <input name="slug" placeholder="slug (e.g. yoga-centres)" aria-label="Slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            <input name="name" placeholder="Name" aria-label="Name" required maxLength={80} />
            <input name="description" placeholder="Description" aria-label="Description" maxLength={500} className="cc-wide-input" />
            <input name="sort_order" type="number" defaultValue={200} aria-label="Order" className="cc-num" />
            <SubmitButton className="bp-btn-secondary" pendingLabel="Creating…">Create</SubmitButton>
          </form>
        </section>
      </section>;
    })()}
  </>;
}
