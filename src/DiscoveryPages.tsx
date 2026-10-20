'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Footer, Header } from './App';
import { asset } from './asset';
import { demoNotice, getCategory, getItem, getItems, items, parentPath, type CategorySlug, type DiscoveryItem } from './discovery-data';

function detailPath(item: DiscoveryItem) {
  const route = item.category === 'food' ? 'food' : item.category === 'stays' ? 'stays' : item.category === 'guides' ? 'guides' : 'places';
  return `/${route}/${item.slug}/`;
}

function ListingCard({ item }: { item: DiscoveryItem }) {
  return <article className="listing-card">
    <Link href={detailPath(item)} className="listing-card-image" style={{ backgroundImage: `url("${asset(item.image)}")` }} aria-label={`Read about ${item.title}`}>
      <span className="demo-pill">Illustrative · unverified</span>
    </Link>
    <div className="listing-card-body">
      <h2><Link href={detailPath(item)}>{item.title}</Link></h2>
      <p>{item.subtitle}</p>
      {item.area && <div className="listing-card-meta"><MapPin size={12} />{item.area}</div>}
      <div className="listing-card-tags">{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
      <Link href={detailPath(item)} className="listing-card-link">Explore this idea <ArrowRight size={14} /></Link>
    </div>
  </article>;
}

function RelatedCategories({ slugs, title = 'Keep exploring' }: { slugs: CategorySlug[]; title?: string }) {
  return <section className="related-band">
    <h2>{title}</h2>
    <div className="related-links">{slugs.map((slug) => {
      const category = getCategory(slug);
      return category ? <Link href={`/${slug}/`} key={slug}>{category.title}<ArrowUpRight size={13} /></Link> : null;
    })}</div>
  </section>;
}

export function CategoryPage({ slug }: { slug: CategorySlug }) {
  const category = getCategory(slug)!;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All ideas');
  const [sort, setSort] = useState('Curated');
  const options = ['All ideas', ...category.filters];
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const found = getItems(slug).filter((item) => {
      const queryMatch = !q || `${item.title} ${item.subtitle} ${item.overview} ${item.tags.join(' ')}`.toLowerCase().includes(q);
      const filterMatch = filter === 'All ideas' || item.tags.some((tag) => tag.toLowerCase() === filter.toLowerCase());
      return queryMatch && filterMatch;
    });
    return sort === 'A to Z' ? [...found].sort((a, b) => a.title.localeCompare(b.title)) : found;
  }, [slug, query, filter, sort]);
  const reset = () => { setQuery(''); setFilter('All ideas'); setSort('Curated'); };
  return <><Header /><main className="discovery-page">
    <section className="discovery-hero" style={{ backgroundImage: `url("${asset(category.image)}")` }}>
      <div className="page-shell discovery-hero-inner"><span className="eyebrow">{category.eyebrow}</span><h1>{category.title}</h1><p>{category.intro}</p></div>
    </section>
    <section className="page-shell">
      <div className="discovery-toolbar">
        <form className="discovery-search" onSubmit={(event) => event.preventDefault()} role="search">
          <Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${category.title.toLowerCase()}…`} aria-label={`Search ${category.title}`} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><ArrowRight size={14} /></button>}
        </form>
        <label className="discovery-sort"><SlidersHorizontal size={14} /> Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort discovery ideas">
            <option>Curated</option><option>A to Z</option>
          </select>
        </label>
      </div>
      <div className="discovery-filters" aria-label="Filter discoveries">{options.map((option) => <button type="button" key={option} onClick={() => setFilter(option)} className={filter === option ? 'active' : ''}>{option}</button>)}</div>
      <div className="discovery-result-note"><span aria-live="polite">{filtered.length} illustrative {filtered.length === 1 ? 'idea' : 'ideas'}{query ? ` matching “${query}”` : ''}</span><span className="demo-pill">Every sample is unverified</span></div>
      <div className="discovery-listing-grid">
        {filtered.length ? filtered.map((item) => <ListingCard key={item.slug} item={item} />) : <div className="empty-discover"><span><Search size={22} /></span><h3>No ideas match those filters</h3><p>Try another word or reset the filters to browse all sample discoveries.</p><button type="button" onClick={reset}>Reset search and filters <ArrowRight size={15} /></button></div>}
      </div>
      <RelatedCategories slugs={category.related} />
      <p className="stay-notice">{demoNotice}</p>
    </section>
  </main><Footer /></>;
}

const stayTypes = ['All stays', 'Hotels', 'Dharamshalas', 'Guest houses', 'Hostels', 'Homestays', 'Rentals'];
const stayAreas = ['Old city', 'Assi side', 'Area not specified'];
const stayBands = ['Value', 'Comfort', 'Premium'];
const roomOptions = ['Single', 'Double', 'Family'];
const amenityOptions = ['Wi-Fi', 'Air conditioning', 'Breakfast', 'River view'];

export function StaysDiscoveryPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All stays');
  const [area, setArea] = useState('');
  const [band, setBand] = useState('');
  const [room, setRoom] = useState('');
  const [amenity, setAmenity] = useState('');
  const [sort, setSort] = useState('Curated');
  const stays = getItems('stays');
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = stays.filter((stay) =>
      (!q || `${stay.title} ${stay.subtitle} ${stay.stayType} ${stay.area}`.toLowerCase().includes(q)) &&
      (type === 'All stays' || stay.stayType === type) &&
      (!area || stay.area === area) &&
      (!band || stay.budgetBand === band) &&
      (!room || stay.roomTypes?.includes(room)) &&
      (!amenity || stay.amenities?.includes(amenity))
    );
    return sort === 'A to Z' ? [...matches].sort((a, b) => a.title.localeCompare(b.title)) : matches;
  }, [stays, query, type, area, band, room, amenity, sort]);
  const reset = () => { setQuery(''); setType('All stays'); setArea(''); setBand(''); setRoom(''); setAmenity(''); setSort('Curated'); };
  return <><Header /><main className="discovery-page stay-discovery">
    <section className="discovery-hero" style={{ backgroundImage: `url("${asset('/kashi-riverfront.jpg')}")` }}>
      <div className="page-shell discovery-hero-inner"><span className="eyebrow">Find your resting place</span><h1>Stay in Kashi</h1><p>From a simple base to a slower stay, explore accommodation styles and shape a search around the way you want to experience the city.</p></div>
    </section>
    <section className="page-shell">
      <div className="discovery-toolbar">
        <form className="discovery-search" onSubmit={(event) => event.preventDefault()} role="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stay ideas or areas…" aria-label="Search stays" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><ArrowRight size={14} /></button>}</form>
        <label className="discovery-sort"><SlidersHorizontal size={14} /> Sort<select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort stay ideas"><option>Curated</option><option>A to Z</option></select></label>
      </div>
      <div className="stay-tabs" aria-label="Accommodation type">{stayTypes.map((value) => <button type="button" key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>{value}</button>)}</div>
      <div className="stay-intro-row"><div><span className="eyebrow">Get your bearings</span><h2>Start with an area</h2></div><p>Broad neighbourhood shortcuts only. Use them to explore a point of view, not as verified property locations.</p></div>
      <div className="stay-area-shortcuts">{stayAreas.map((value) => <button key={value} type="button" onClick={() => setArea(area === value ? '' : value)} className={`stay-band-filters-button ${area === value ? 'active' : ''}`}>{value}<ArrowRight size={13} /></button>)}</div>
      <div className="stay-filter-block"><strong>Browse by budget band</strong><div className="stay-band-filters">{stayBands.map((value) => <button key={value} className={band === value ? 'active' : ''} onClick={() => setBand(band === value ? '' : value)} type="button">{value}</button>)}</div></div>
      <div className="stay-filter-block"><strong>Room type</strong><div className="stay-feature-filters">{roomOptions.map((value) => <button key={value} type="button" className={room === value ? 'active' : ''} onClick={() => setRoom(room === value ? '' : value)}>{value}</button>)}</div></div>
      <div className="stay-filter-block"><strong>Amenities</strong><div className="stay-feature-filters">{amenityOptions.map((value) => <button key={value} type="button" className={amenity === value ? 'active' : ''} onClick={() => setAmenity(amenity === value ? '' : value)}>{value}</button>)}</div></div>
      <div className="discovery-result-note"><span aria-live="polite">{filtered.length} sample stay {filtered.length === 1 ? 'idea' : 'ideas'}</span><span className="demo-pill">Attributes are illustrative</span></div>
      <div className="discovery-listing-grid">{filtered.length ? filtered.map((stay) => <ListingCard key={stay.slug} item={stay} />) : <div className="empty-discover"><span><Search size={22} /></span><h3>No stay ideas match just yet</h3><p>Clear the selected filters to return to all accommodation categories.</p><button type="button" onClick={reset}>Reset stay filters <ArrowRight size={15} /></button></div>}</div>
      <p className="stay-notice">Value, Comfort and Premium are non-numeric demo bands only. Room types, amenity tags and area shortcuts are illustrative filter examples, not property claims. No prices, availability, ratings, reviews, contacts or verified accommodation listings are shown.</p>
      <RelatedCategories slugs={['areas', 'travel', 'guides']} title="Plan the rest of your stay" />
    </section>
  </main><Footer /></>;
}

export function DetailPage({ slug, allowed }: { slug: string; allowed: CategorySlug[] }) {
  const item = getItem(slug);
  if (!item || !allowed.includes(item.category)) return <><Header /><main className="page-shell route-not-found"><span className="eyebrow">Not found</span><h1>This discovery isn’t here.</h1><p>The page may have moved, or this sample may not be part of the guide.</p><Link href="/" className="button-primary">Return to KashiNagri <ArrowRight size={15} /></Link></main><Footer /></>;
  const parent = getCategory(item.category)!;
  const related = items.filter((entry) => entry.category === item.category && entry.slug !== item.slug).slice(0, 3);
  return <><Header /><main className="page-shell detail-page">
    <Link href={parentPath(item.category)} className="detail-back"><ArrowLeft size={15} /> Back to {parent.title}</Link>
    <div className="detail-layout">
      <div className="detail-gallery" role="img" aria-label={item.imageAlt} style={{ backgroundImage: `url("${asset(item.image)}")` }}><span className="detail-gallery-label">An illustrative view of Kashi</span></div>
      <article className="detail-copy">
        <span className="eyebrow">{parent.eyebrow}</span><h1>{item.title}</h1>
        <p>{item.overview}</p>
        <div className="detail-status"><Sparkles size={16} /><span>{demoNotice}</span></div>
        <div className="detail-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {item.area && <section className="detail-context"><h2>Area context</h2><p>{item.area === 'Area not specified' ? 'No area is specified for this sample.' : `${item.area} is shown as broad illustrative context only, not as a verified address or location for a provider.`}</p></section>}
        <section className="detail-context"><h2>A little context</h2><p>{item.context}</p></section>
        <section className="detail-context"><h2>Practical note</h2><p>No verified address, timings, prices, availability, directions or business contact details are available for this demo entry. Confirm current details independently before visiting or making arrangements.</p></section>
      </article>
    </div>
    {related.length > 0 && <section className="detail-related"><div className="stay-intro-row"><div><span className="eyebrow">Continue your discovery</span><h2>Related ideas</h2></div><Link href={parentPath(item.category)} className="listing-card-link">View the category <ArrowRight size={14} /></Link></div><div className="discovery-listing-grid">{related.map((entry) => <ListingCard key={entry.slug} item={entry} />)}</div></section>}
    <RelatedCategories slugs={parent.related.filter((categorySlug) => categorySlug !== item.category).slice(0, 3)} />
  </main><Footer /></>;
}

