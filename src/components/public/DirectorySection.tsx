import Link from 'next/link';
import { ArrowRight, BadgeCheck, MapPin } from 'lucide-react';
import type { PublicCard } from '@/lib/public/listings';

/**
 * "Listed on KashiNagri" band for public category pages. Renders nothing when
 * there are no published listings, so the existing page is unchanged until
 * real content is approved.
 */
export function DirectorySection({ cards, title = 'Listed on KashiNagri', showEmpty = false, browseHref = '/directory/' }: { cards: PublicCard[]; title?: string; showEmpty?: boolean; browseHref?: string | null }) {
  if (cards.length === 0) {
    return showEmpty ? <section className="directory-band directory-empty" aria-label="Verified listings">
      <span className="eyebrow">Verified listings</span>
      <p>No verified businesses are listed in this section yet. The ideas above are illustrative.</p>
      <Link href="/business/onboarding/" className="listing-card-link" data-testid="link-directory-empty-cta">Run a business here? List it on KashiNagri <ArrowRight size={14} /></Link>
    </section> : null;
  }
  return <section className="directory-band" aria-labelledby="directory-title">
    <div className="directory-head">
      <span className="eyebrow">Reviewed by our team</span>
      <h2 id="directory-title">{title}</h2>
      <p>Businesses here are verified and every listing is checked before it goes live. Confirm timings and prices directly.</p>
    </div>
    <div className="discovery-listing-grid">{cards.map(card => <article className="listing-card" key={card.id}>
      <Link href={`/listings/${card.slug}/`} className="listing-card-image" style={card.cover ? { backgroundImage: `url("${card.cover}")` } : undefined} aria-label={`Open ${card.title}`}>
        <span className="demo-pill directory-pill">{card.sponsoredLabel ?? (card.businessName ? <><BadgeCheck size={11} /> Verified business</> : 'KashiNagri curated')}</span>
      </Link>
      <div className="listing-card-body">
        <h2><Link href={`/listings/${card.slug}/`}>{card.title}</Link></h2>
        <p>{card.summary ?? card.subtype ?? card.category}</p>
        {card.area && <div className="listing-card-meta"><MapPin size={12} />{card.area}</div>}
        <div className="listing-card-tags">{[card.subtype, card.businessName].filter(Boolean).slice(0, 2).map(t => <span key={t}>{t}</span>)}</div>
        <Link href={`/listings/${card.slug}/`} className="listing-card-link">View listing <ArrowRight size={14} /></Link>
      </div>
    </article>)}</div>
    {browseHref && <Link href={browseHref} className="listing-card-link directory-browse" data-testid="link-directory-browse">Search all verified businesses by category and area <ArrowRight size={14} /></Link>}
  </section>;
}
