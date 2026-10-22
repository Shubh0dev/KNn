'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, MapPin } from 'lucide-react';
import type { PublicCard } from '@/lib/public/listings';
import { LoaderLabel } from '@/components/loading/InlineLoader';
import { spinnersEnabled } from '@/lib/loading/config';
import { useDelayedLoading } from '@/lib/loading/useDelayedLoading';

/** Verified listings from the KashiNagri directory matching the Explore search. */
export function DirectorySearch({ query }: { query: string }) {
  const [results, setResults] = useState<PublicCard[]>([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();
  // Only appears if the search is slow; fast results never flash a loading state.
  const showLoading = useDelayedLoading(loading, spinnersEnabled('inline'));

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/listings/search/?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = res.ok ? await res.json() as { results: PublicCard[] } : { results: [] };
        setResults(json.results ?? []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [q]);

  if (q.length < 2 || (results.length === 0 && !showLoading)) return null;
  return <section className="directory-search" aria-live="polite" aria-label="Verified listings">
    <div className="directory-search-head"><span className="eyebrow">Listed on KashiNagri</span>{showLoading
      ? <LoaderLabel label="Searching verified listings…" testId="directory-search-loading" />
      : <strong>{`${results.length} verified ${results.length === 1 ? 'listing' : 'listings'} for “${q}”`}</strong>}</div>
    <div className="directory-search-list">{results.map(card => <Link key={card.id} href={`/listings/${card.slug}/`} className="directory-search-item" data-testid={`search-result-${card.slug}`}>
      <span className="directory-search-thumb" style={card.cover ? { backgroundImage: `url("${card.cover}")` } : undefined} aria-hidden="true" />
      <span className="directory-search-copy">
        <strong>{card.title}</strong>
        <small>{[card.category, card.subtype].filter(Boolean).join(' · ')}{card.area ? <> · <MapPin size={11} /> {card.area}</> : null}</small>
        <small className="directory-search-trust">{card.businessName ? <><BadgeCheck size={11} /> Verified business</> : 'KashiNagri curated'}</small>
      </span>
      <ArrowRight size={15} />
    </Link>)}</div>
  </section>;
}
