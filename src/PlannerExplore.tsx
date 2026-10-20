'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Bookmark, Check, Compass, Copy, MapPin, Printer, RotateCcw, Search, Share2, Sparkles } from 'lucide-react';
import { Footer, Header } from './App';
import { demoNotice, items, type DiscoveryItem } from './discovery-data';
import {
  areaNeighbours, areaTitle, budgetLabels, detailHref, formatItinerary, interestOptions, itemsNearArea,
  lengthOptions, makeItinerary, tripAreas,
  type BudgetLens, type Interest, type TripLength, type TripPace, type TripPreferences,
} from './planner-rules';

const STORAGE_KEY = 'kashi-nagri-saved-trip-v1';
const defaultPreferences: TripPreferences = { length: 'one', budget: 'comfortable', interests: ['ghats', 'food', 'history'], area: '', pace: 'relaxed' };

function isLength(value: string | null): value is TripLength { return value === 'half' || value === 'one' || value === 'two' || value === 'three'; }
function isBudget(value: string | null): value is BudgetLens { return value === 'economical' || value === 'comfortable' || value === 'premium'; }
function isPace(value: string | null): value is TripPace { return value === 'relaxed' || value === 'packed'; }
function isInterest(value: string): value is Interest { return interestOptions.some((interest) => interest.value === value); }

function encodePreferences(preferences: TripPreferences) {
  const params = new URLSearchParams();
  params.set('length', preferences.length);
  params.set('budget', preferences.budget);
  params.set('interests', preferences.interests.join(','));
  params.set('pace', preferences.pace);
  if (preferences.area) params.set('area', preferences.area);
  return params.toString();
}

function readPreferences(params: URLSearchParams): TripPreferences | null {
  const length = params.get('length');
  const budget = params.get('budget');
  const pace = params.get('pace');
  if (!isLength(length) || !isBudget(budget) || !isPace(pace)) return null;
  const selectedInterests = (params.get('interests') ?? '').split(',').filter(isInterest);
  const area = tripAreas.some((entry) => entry.slug === params.get('area')) ? params.get('area') ?? '' : '';
  return { length, budget, pace, interests: selectedInterests, area };
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', 'true');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Copy is unavailable in this browser.');
}

function sampleCard(item: DiscoveryItem, index: number) {
  return <Link className="discovery-card" href={detailHref(item)} key={item.slug} data-testid={`card-explore-${item.slug}`}>
    <div className="discovery-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,20,16,.57), transparent 72%), url("${item.image}")` }}>
      <span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="card-label">Illustrative</span><span className="image-arrow"><ArrowUpRight size={15} /></span>
    </div>
    <div className="discovery-copy"><h3>{item.title}</h3><p>{item.subtitle}{item.area ? ` · ${item.area}` : ''}</p></div>
  </Link>;
}

export function TripPlanner() {
  const searchParams = useSearchParams();
  const [preferences, setPreferences] = useState<TripPreferences>(defaultPreferences);
  const [status, setStatus] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [hasSavedPlan, setHasSavedPlan] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const days = useMemo(() => makeItinerary(preferences), [preferences]);
  const itineraryText = useMemo(() => formatItinerary(preferences, days), [preferences, days]);
  const shareHref = useMemo(() => `/plan-my-trip/?${encodePreferences(preferences)}`, [preferences]);

  useEffect(() => {
    const urlValues = readPreferences(new URLSearchParams(searchParams ? searchParams.toString() : ''));
    if (urlValues) {
      setPreferences(urlValues);
      setStatus('This plan was rebuilt from its shared preferences.');
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { preferences?: TripPreferences; savedAt?: string };
          if (parsed.preferences && isLength(parsed.preferences.length) && isBudget(parsed.preferences.budget) && isPace(parsed.preferences.pace)) {
            setPreferences({ ...defaultPreferences, ...parsed.preferences });
            setSavedAt(parsed.savedAt ?? '');
            setHasSavedPlan(true);
          }
        }
      } catch {
        setStatus('A saved plan could not be read. You can start a fresh outline.');
      }
    }
    setIsReady(true);
  }, [searchParams]);

  function updatePreference<K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setStatus('');
  }

  function savePlan() {
    const stamp = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preferences, savedAt: stamp }));
      setSavedAt(stamp);
      setHasSavedPlan(true);
      setStatus('Plan saved on this browser and device only. It is not synced or backed up.');
    } catch {
      setStatus('This browser could not save the plan. Try enabling local storage or use the share link.');
    }
  }

  function restorePlan() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setStatus('There is no saved plan on this browser yet.');
        return;
      }
      const parsed = JSON.parse(stored) as { preferences?: TripPreferences; savedAt?: string };
      if (!parsed.preferences) throw new Error('Saved plan is incomplete.');
      setPreferences(parsed.preferences);
      setSavedAt(parsed.savedAt ?? '');
      setHasSavedPlan(true);
      setStatus('Your saved outline is restored on this device.');
    } catch {
      setStatus('The saved plan could not be restored. You can create a new outline.');
    }
  }

  async function sharePlan() {
    const absoluteUrl = `${window.location.origin}${shareHref}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Kashi plan', text: 'A thoughtful starting outline for time in Varanasi.', url: absoluteUrl });
        setStatus('Share sheet opened.');
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await copyText(absoluteUrl);
      setStatus('Share link copied. It opens with these same preferences.');
    } catch {
      setStatus('Could not copy the link. Use the URL shown in your address bar or try another browser.');
    }
  }

  async function copyItinerary() {
    try {
      await copyText(itineraryText);
      setStatus('Itinerary copied to your clipboard.');
    } catch {
      setStatus('Could not copy the itinerary. Try selecting and copying the plan text.');
    }
  }

  const titleForLength = lengthOptions.find((option) => option.value === preferences.length)?.label ?? 'A visit';
  return <><Header /><main className="planner-page page-shell">
    <section className="planner-hero">
      <span className="planner-kicker">My Kashi Trip · A thoughtful starting point</span>
      <h1>Make a little room<br /><em>for your own rhythm.</em></h1>
      <p>Build a simple outline from KashiNagri’s sample discoveries. Keep it flexible, make space to pause, and confirm current details locally before you set out.</p>
    </section>
    <div className="planner-layout">
      <aside className="planner-editor" aria-labelledby="planner-editor-title">
        <div className="planner-editor-head"><div><span className="eyebrow">Shape your outline</span><h2 id="planner-editor-title">Your preferences</h2></div><span>Local & flexible</span></div>
        <div className="planner-field"><label htmlFor="trip-length">Available time</label><select id="trip-length" value={preferences.length} onChange={(event) => updatePreference('length', event.target.value as TripLength)} data-testid="select-trip-length">{lengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="planner-field"><label htmlFor="trip-budget">Budget lens</label><select id="trip-budget" value={preferences.budget} onChange={(event) => updatePreference('budget', event.target.value as BudgetLens)} data-testid="select-trip-budget"><option value="economical">Economical</option><option value="comfortable">Comfortable</option><option value="premium">Premium</option></select></div>
        <fieldset className="planner-field"><legend>What interests you? Choose any</legend><div className="planner-options">{interestOptions.map(({ value, label }) => <label className="planner-choice" key={value}><input type="checkbox" checked={preferences.interests.includes(value)} onChange={(event) => updatePreference('interests', event.target.checked ? [...preferences.interests, value] : preferences.interests.filter((interest) => interest !== value))} aria-label={label} data-testid={`checkbox-interest-${value}`} />{label}</label>)}</div></fieldset>
        <div className="planner-field"><label htmlFor="trip-area">Starting area <span>(optional)</span></label><select id="trip-area" value={preferences.area} onChange={(event) => updatePreference('area', event.target.value)} data-testid="select-trip-area"><option value="">No preference</option>{tripAreas.map((area) => <option value={area.slug} key={area.slug}>{area.title}</option>)}</select></div>
        <fieldset className="planner-field"><legend>Daily pace</legend><div className="planner-options"><button type="button" className="planner-choice" aria-pressed={preferences.pace === 'relaxed'} onClick={() => updatePreference('pace', 'relaxed')} data-testid="button-pace-relaxed">Relaxed</button><button type="button" className="planner-choice" aria-pressed={preferences.pace === 'packed'} onClick={() => updatePreference('pace', 'packed')} data-testid="button-pace-packed">More to explore</button></div></fieldset>
        <p className="planner-editor-note">Budget is only a planning lens: this sample contains no verified prices, costs or trip total. “More to explore” adds ideas, not travel-time promises.</p>
        <button type="button" className="button-primary planner-generate" onClick={() => { setStatus('Your outline is refreshed from the preferences above.'); }} data-testid="button-generate-itinerary"><Sparkles size={15} /> Refresh my outline <ArrowRight size={15} /></button>
      </aside>
      <section className="planner-result" aria-labelledby="itinerary-title">
        <div className="planner-result-head"><div><span className="eyebrow">A flexible outline</span><h2 id="itinerary-title">{titleForLength}<em> in Kashi</em></h2></div><div className="planner-meta"><strong>{preferences.pace === 'relaxed' ? 'Room to pause' : 'A fuller rhythm'}</strong>{preferences.area ? `Beginning around ${areaTitle(preferences.area)}` : 'Starting area is open'}</div></div>
        <p className="planner-cost-note">Budget lens: <strong>{budgetLabels[preferences.budget]}</strong>. It helps frame the kind of visit you have in mind; no trip total, live cost, venue price, route, opening time or visit-duration estimate is calculated.</p>
        <div className="planner-actions" aria-label="Plan actions">
          <button type="button" className="planner-action" onClick={copyItinerary} data-testid="button-copy-itinerary"><Copy size={14} /> Copy itinerary</button>
          <button type="button" className="planner-action" onClick={sharePlan} data-testid="button-share-itinerary"><Share2 size={14} /> Share plan</button>
          <button type="button" className={`planner-action ${hasSavedPlan ? 'saved' : ''}`} onClick={savePlan} data-testid="button-save-itinerary">{hasSavedPlan ? <Check size={14} /> : <Bookmark size={14} />} Save on this device</button>
          <button type="button" className="planner-action" onClick={restorePlan} data-testid="button-restore-itinerary"><RotateCcw size={14} /> Restore saved</button>
          <button type="button" className="planner-action" onClick={() => window.print()} data-testid="button-print-itinerary"><Printer size={14} /> Print</button>
        </div>
        {hasSavedPlan && savedAt && <p className="planner-editor-note">Saved in this browser on {new Date(savedAt).toLocaleDateString()} · not synced or backed up.</p>}
        <p className="planner-status" role="status" aria-live="polite">{status || (isReady ? 'Change a preference and refresh, save, copy, share or print your outline.' : 'Preparing your outline…')}</p>
        {days.map((day) => <article className="planner-day" key={day.number}>
          <header className="planner-day-head"><span>Day {String(day.number).padStart(2, '0')}</span><h3>{day.theme || 'A little of everything'}</h3></header>
          <div className="planner-timeline">{day.stops.map((stop, index) => stop.kind === 'discovery' ? <div className="planner-stop" key={`${day.number}-${stop.item.slug}-${index}`}>
            <div className="planner-time">{stop.time}</div><div className="planner-stop-content"><h4>{stop.item.title}</h4><p>{stop.reason}</p><Link href={detailHref(stop.item)} data-testid={`link-itinerary-${stop.item.slug}`}>Read this discovery <ArrowUpRight size={13} /></Link></div>
          </div> : <div className="planner-stop planner-break" key={`${day.number}-break-${index}`}><div className="planner-time">{stop.time}</div><div className="planner-stop-content"><h4>{stop.title}</h4><p>{stop.reason}</p></div></div>)}</div>
        </article>)}
        <p className="planner-footnote">{demoNotice} The itinerary is generated deterministically in this browser from the sample guide; no AI or network service is used. Check access, safety, schedules and conditions independently.</p>
      </section>
    </div>
  </main><Footer /></>;
}

const categories = ['All', ...Array.from(new Set(items.map((entry) => entry.category)))];

export function ExploreDiscovery() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') ?? '';
  const initialCategory = searchParams?.get('category') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(categories.includes(initialCategory) ? initialCategory : 'All');
  const [selectedArea, setSelectedArea] = useState('');
  const [sort, setSort] = useState('Curated ideas');

  useEffect(() => {
    const qParam = searchParams?.get('q') ?? '';
    const catParam = searchParams?.get('category') ?? '';
    setQuery(qParam || (categories.includes(catParam) ? '' : catParam));
    const routeCategory = catParam;
    setCategory(categories.includes(routeCategory) ? routeCategory : 'All');
  }, [searchParams]);

  const nearby = useMemo(() => itemsNearArea(selectedArea), [selectedArea]);
  const nearbySlugs = useMemo(() => new Set([selectedArea, ...nearby.map((entry) => entry.slug)]), [nearby, selectedArea]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matching = items.filter((entry) => {
      const inCategory = category === 'All' || entry.category === category;
      const text = `${entry.title} ${entry.subtitle} ${entry.overview} ${entry.context} ${entry.tags.join(' ')} ${entry.area ?? ''}`.toLowerCase();
      const inQuery = !normalizedQuery || text.includes(normalizedQuery);
      const inArea = !selectedArea || nearbySlugs.has(entry.slug);
      return inCategory && inQuery && inArea;
    });
    return sort === 'A to Z' ? [...matching].sort((a, b) => a.title.localeCompare(b.title)) : matching;
  }, [category, nearbySlugs, query, selectedArea, sort]);

  function updateUrl(nextQuery: string) {
    const url = new URL(window.location.href);
    if (nextQuery.trim()) url.searchParams.set('q', nextQuery.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateUrl(query);
  }
  const resetFilters = () => { setQuery(''); setCategory('All'); setSelectedArea(''); setSort('Curated ideas'); updateUrl(''); };
  const visibleNearby = nearby.slice(0, 5);

  return <><Header /><main className="explore-page">
    <section className="explore-intro page-shell"><div><span className="eyebrow">Kashi, by your curiosity</span><h1 className="serif">Explore the city<br /><em>one discovery at a time.</em></h1><p>Search one shared collection of illustrative places and experiences. Browse by topic or choose an area for a small, curated set of nearby ideas.</p></div>
      <div className="explore-search-wrap"><form className="hero-search" role="search" onSubmit={submitSearch}><MapPin size={18} className="search-pin" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search sample places and experiences" placeholder="Try ghats, food, old city or weaving" data-testid="input-explore-query" /><button type="submit" data-testid="button-explore-search"><Search size={16} /><span>Search</span></button></form></div>
    </section>
    <section className="page-shell explore-area-layout">
      <aside className="area-map-card" aria-label="Choose a Varanasi area">
        <div className="area-map-title"><span>Get your bearings</span><small>Area view</small></div>
        <div className="area-schematic" aria-label="Schematic area index, not a geographic map">
          <span className="area-river-label">GANGA · RIVERFRONT</span>
          {tripAreas.map((area) => <button type="button" key={area.slug} className="area-map-option" aria-pressed={selectedArea === area.slug} onClick={() => setSelectedArea(selectedArea === area.slug ? '' : area.slug)} data-testid={`button-area-${area.slug}`}><span aria-hidden="true" />{area.title}</button>)}
        </div>
        <p className="area-map-note">Schematic area index · not to scale and not for navigation. No pins, coordinates, distances, routes or travel times are represented.</p>
        {selectedArea && <section className="explore-nearby" aria-live="polite"><h3>Nearby ideas around {areaTitle(selectedArea)}</h3><div className="explore-nearby-links">{visibleNearby.map((entry) => <Link key={entry.slug} href={detailHref(entry)} data-testid={`link-nearby-${entry.slug}`}>{entry.title}<ArrowUpRight size={12} /></Link>)}</div></section>}
      </aside>
      <div className="results-side">
        <div className="results-head"><div><span className="eyebrow">Browse discoveries</span><h2 className="serif">{filtered.length} <em>ideas to begin with</em></h2></div><label className="sort-label">Showing <select aria-label="Sort discovery ideas" value={sort} onChange={(event) => setSort(event.target.value)} data-testid="select-explore-sort"><option>Curated ideas</option><option>A to Z</option></select></label></div>
        <div className="category-filters" aria-label="Filter by category">{categories.map((value) => <button type="button" className={category === value ? 'selected' : ''} key={value} onClick={() => setCategory(value)} data-testid={`filter-explore-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</button>)}</div>
        <div className="explore-area-filter" aria-label="Filter by area"><span className="explore-category-label">Area notes</span><button type="button" aria-pressed={!selectedArea} onClick={() => setSelectedArea('')} data-testid="filter-area-all">All areas</button>{tripAreas.map((area) => <button type="button" key={area.slug} aria-pressed={selectedArea === area.slug} onClick={() => setSelectedArea(selectedArea === area.slug ? '' : area.slug)} data-testid={`filter-area-${area.slug}`}>{area.title}</button>)}</div>
        <p className="result-count" aria-live="polite">{filtered.length} sample {filtered.length === 1 ? 'idea' : 'ideas'}{query && <> matching <strong>“{query}”</strong></>}{selectedArea && <> around <strong>{areaTitle(selectedArea)}</strong></>}</p>
        {selectedArea && <button type="button" className="explore-area-clear" onClick={() => setSelectedArea('')}>Clear area filter</button>}
        {filtered.length ? <div className="explore-results">{filtered.map((entry, index) => sampleCard(entry, index))}</div> : <div className="empty-discover"><span><Compass size={24} /></span><h3>No discoveries found</h3><p>Try a broader search, another area, or clear filters to browse the full sample guide.</p><button type="button" onClick={resetFilters} data-testid="button-clear-explore-filters">Clear search and filters <ArrowRight size={15} /></button></div>}
        <p className="explore-sample-note">{demoNotice} The source collection has no known venue coordinates, exact distances, opening times, travel routes, travel-time accuracy or visit-duration estimates. Area relationships are curated editorial suggestions only.</p>
      </div>
    </section>
    <section className="explore-trip-cta page-shell"><div><span className="eyebrow">Have a little time?</span><h2 className="serif">Give the day your own shape.</h2><p>Build a flexible outline from the same sample discoveries. No booking flow, live pricing or AI required.</p></div><Link href="/plan-my-trip/" className="button-primary" data-testid="link-explore-plan-trip">Plan a thoughtful visit <ArrowRight size={16} /></Link></section>
  </main><Footer /></>;
}
