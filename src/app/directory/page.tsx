import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer, Header } from '../../App';
import { DirectorySection } from '@/components/public/DirectorySection';
import { getFilteredDirectory } from '@/lib/public/listings';

export const metadata: Metadata = {
  title: 'Business directory | KashiNagri',
  description: 'Search verified stays, restaurants, guides, shops and local services in Varanasi. Every listing is checked by the KashiNagri team.',
};

const CATEGORIES = [
  { slug: 'stays', label: 'Stays and hotels' },
  { slug: 'food', label: 'Restaurants and cafés' },
  { slug: 'guides', label: 'Guides and tours' },
  { slug: 'events', label: 'Local experiences' },
  { slug: 'travel', label: 'Boats and transport' },
  { slug: 'shopping', label: 'Shopping' },
  { slug: 'spiritual-services', label: 'Spiritual services' },
  { slug: 'local-services', label: 'Local services' },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? '').trim();

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    q: first(params.q).slice(0, 60),
    category: CATEGORIES.some(c => c.slug === first(params.category)) ? first(params.category) : '',
    area: first(params.area).slice(0, 80),
  };
  const { cards, areas } = await getFilteredDirectory(filters);
  const filtered = Boolean(filters.q || filters.category || filters.area);
  const label = CATEGORIES.find(c => c.slug === filters.category)?.label;

  return <><Header /><main className="page-shell directory-page">
    <section className="directory-page-head">
      <span className="eyebrow">Verified businesses</span>
      <h1 className="serif">Business directory</h1>
      <p>Live listings from local businesses verified by our team. Contact them directly or send a request. Prices and availability are confirmed by the business.</p>
    </section>
    <form className="directory-filters" role="search" aria-label="Filter the directory" action="/directory/">
      <label><span>Search</span><input name="q" defaultValue={filters.q} placeholder="Name, area or type…" data-testid="input-directory-q" /></label>
      <label><span>Category</span><select name="category" defaultValue={filters.category} data-testid="select-directory-category">
        <option value="">All categories</option>
        {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select></label>
      <label><span>Area</span><select name="area" defaultValue={filters.area} data-testid="select-directory-area">
        <option value="">All areas</option>
        {areas.map(a => <option key={a} value={a}>{a}</option>)}
        {filters.area && !areas.includes(filters.area) && <option value={filters.area}>{filters.area}</option>}
      </select></label>
      <button type="submit" className="button-primary" data-testid="button-directory-search">Search</button>
      {filtered && <Link href="/directory/" className="directory-clear">Clear filters</Link>}
    </form>
    <p className="directory-count" data-testid="directory-count" aria-live="polite">
      {cards.length === 0 ? 'No verified businesses match yet.' : `${cards.length} verified ${cards.length === 1 ? 'business' : 'businesses'}${label ? ` in ${label.toLowerCase()}` : ''}${filters.area ? ` in ${filters.area}` : ''}`}
    </p>
    {cards.length > 0
      ? <DirectorySection cards={cards} title={label ?? 'All verified businesses'} browseHref={null} />
      : <section className="directory-band directory-empty">
          <p>{filtered ? 'Try a different search, category or area.' : 'No businesses have been verified yet. Curated guides to temples, ghats and food are on the category pages.'}</p>
          <Link href="/business/onboarding/" className="listing-card-link">Run a business in Kashi? List it on KashiNagri</Link>
        </section>}
  </main><Footer /></>;
}
