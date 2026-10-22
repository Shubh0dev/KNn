'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowUpRight, BedDouble, BookOpen, CalendarDays,
  Check, ChevronDown, CircleUserRound, Compass, Flower2, Globe2, HeartHandshake, MapPin, Menu,
  Navigation, Search, ShoppingBag, Sparkles, Store, TrainFront, Utensils, Waves, X,
} from 'lucide-react';
import { asset } from './asset';
import { createClient } from './lib/supabase/client';
import { isSupabaseConfigured } from './lib/supabase/env';
import type { PublicCard } from './lib/public/listings';
import { trackEvent } from './lib/analytics/client';
import { signalNavigationStart } from '@/lib/loading/navigation';
import {
  allDiscoveries, areas, events, experiences, foods, sampleNote, shortcuts,
  shopping, spiritual, stays, transport, type Discovery,
} from './data';

const shortcutIcons: Record<string, typeof Compass> = {
  temple: Sparkles, waves: Waves, bed: BedDouble, utensils: Utensils, train: TrainFront,
  flower: Flower2, compass: Compass, shopping: ShoppingBag, store: Store, route: Navigation,
  calendar: CalendarDays, more: ArrowRight,
};

function Brand() {
  return <Link href="/" className="brand-lockup" aria-label="KashiNagri home" data-testid="link-brand">
    <span className="brand-mark" aria-hidden="true"><span>क</span></span>
    <span className="brand-copy"><strong>KashiNagri</strong><small>Your Complete Guide to Kashi</small></span>
  </Link>;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'हिं'>('EN');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const router = useRouter();
  const [topQuery, setTopQuery] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    trackEvent('search', { term: topQuery });
    const href = `/explore?q=${encodeURIComponent(topQuery.trim())}`;
    signalNavigationStart(href);
    router.push(href);
    setMenuOpen(false);
  };
  const navGroups = [
    { name: 'Temples & Darshan', route: '/temples', choices: ['Kashi Vishwanath', 'Temple etiquette', 'Darshan guide'] },
    { name: 'Ghats & Ganga', route: '/ghats', choices: ['Explore the ghats', 'Ganga Aarti', 'River journeys'] },
    { name: 'Stay in Kashi', route: '/stays', choices: ['Budget rooms', 'Heritage stays', 'Homestays'] },
    { name: 'Food & Dining', route: '/food', choices: ['Street food', 'Traditional thali', 'Cafés'] },
    { name: 'Travel', route: '/travel', choices: ['Getting around', 'Railway connections', 'Airport arrivals'] },
    { name: 'Shopping', route: '/shopping', choices: ['Banarasi sarees', 'Handicrafts', 'Local markets'] },
    { name: 'Spiritual Services', route: '/spiritual-services', choices: ['Puja & path', 'Pandit & purohit', 'Jyotish'] },
    { name: 'Guides', route: '/guides', choices: ['Temple walks', 'Food walks', 'Ghat stories'] },
    { name: 'Events', route: '/events', choices: ['Festivals', 'Ganga Aarti', 'Seasonal calendar'] },
    { name: 'More', route: '/local-businesses', choices: ['Local directory', 'Areas of Kashi', 'My Kashi Trip'] },
  ];
  const routeFor = (label: string) => {
    if (label === 'My Kashi Trip') return '/plan-my-trip';
    const map: Record<string, string> = {
      'Kashi Vishwanath': '/places/kashi-vishwanath', 'Temple etiquette': '/places/temple-etiquette',
      'Darshan guide': '/temples', 'Explore the ghats': '/ghats', 'Ganga Aarti': '/places/daily-aarti-context',
      'River journeys': '/places/river-journey-context', 'Budget rooms': '/stays/value-rooms',
      'Heritage stays': '/stays/heritage-inspired-stay', 'Homestays': '/stays/local-homestay',
      'Street food': '/food/morning-kachori', 'Traditional thali': '/food', 'Cafés': '/food/chai-pause',
      'Getting around': '/places/moving-through-lanes', 'Railway connections': '/places/arriving-by-rail',
      'Airport arrivals': '/travel', 'Banarasi sarees': '/places/banarasi-weaving',
      'Handicrafts': '/shopping', 'Local markets': '/places/market-wander', 'Puja & path': '/places/puja-basics',
      'Pandit & purohit': '/places/finding-spiritual-guidance', 'Jyotish': '/places/jyotish-context',
      'Temple walks': '/guides/old-city-walk', 'Food walks': '/guides/food-culture-walk',
      'Ghat stories': '/guides/river-stories', 'Festivals': '/places/dev-deepawali-context',
      'Seasonal calendar': '/events', 'Local directory': '/local-businesses', 'Areas of Kashi': '/areas',
    };
    return map[label] ?? `/explore?q=${encodeURIComponent(label)}`;
  };
  return <header className="site-header">
    <div className="header-main page-shell">
      <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} data-testid="button-mobile-menu">
        {menuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>
      <Brand />
      <form className="header-search" onSubmit={submit} role="search">
        <Search size={16} />
        <input value={topQuery} onChange={e => setTopQuery(e.target.value)} aria-label="Search KashiNagri" placeholder="Find a place, flavour or experience" data-testid="input-header-search" />
        <button aria-label="Search" type="submit" data-testid="button-header-search"><ArrowRight size={16} /></button>
      </form>
      <div className="header-actions">
        <Link href="/explore" className="map-link" data-testid="link-explore-map"><MapPin size={16} /><span>Explore on map</span></Link>
        <div className="language-wrap">
          <button className="language-button" onClick={() => setLanguage(language === 'EN' ? 'हिं' : 'EN')} aria-label="Change language" data-testid="button-language"><Globe2 size={15} /> {language} <ChevronDown size={12} /></button>
        </div>
        <AccountLink />
      </div>
    </div>
    <nav className={`desktop-nav ${menuOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
      <div className="nav-inner page-shell">
        <Link href="/" className="nav-home" onClick={() => setMenuOpen(false)} data-testid="link-nav-home">Home</Link>
        {navGroups.map(group => <div className="nav-group" key={group.name}>
          <button className={`nav-trigger ${activeDropdown === group.name ? 'selected' : ''}`} onClick={() => setActiveDropdown(activeDropdown === group.name ? null : group.name)} aria-expanded={activeDropdown === group.name} data-testid={`button-nav-${group.name.toLowerCase().replaceAll(' ', '-')}`}>
            {group.name}<ChevronDown size={12} />
          </button>
          {activeDropdown === group.name && <div className="nav-popover">
            <span className="eyebrow">Discover in Kashi</span>
            <Link href={group.route} onClick={() => { setActiveDropdown(null); setMenuOpen(false); }}>Browse all {group.name}<ArrowRight size={13} /></Link>
            {group.choices.map(choice => <Link key={choice} href={routeFor(choice)} onClick={() => { setActiveDropdown(null); setMenuOpen(false); }} data-testid={`link-menu-${choice.toLowerCase().replaceAll(' ', '-')}`}>{choice}<ArrowUpRight size={13} /></Link>)}
          </div>}
        </div>)}
        <Link href="/plan-my-trip" className="nav-trip" onClick={() => setMenuOpen(false)} data-testid="link-nav-trip">My Kashi Trip <ArrowUpRight size={13} /></Link>
      </div>
    </nav>
    {activeDropdown && <button className="menu-scrim" onClick={() => setActiveDropdown(null)} aria-label="Close navigation dropdown" />}
  </header>;
}

/** Display-only: reads the local session cookie to pick a label. Access control happens on the server. */
function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn
    ? <Link href="/account/" className="account-link" data-testid="link-my-account"><CircleUserRound size={19} /><span>My account</span></Link>
    : <Link href="/login/" className="account-link" data-testid="button-login-register"><CircleUserRound size={19} /><span>Login / Register</span></Link>;
}

function SearchBox({ initial = '', onSearch, buttonLabel = 'Explore Kashi' }: { initial?: string; onSearch: (value: string) => void; buttonLabel?: string }) {
  const [query, setQuery] = useState(initial);
  const submit = (event: FormEvent) => { event.preventDefault(); trackEvent('search', { term: query }); onSearch(query.trim()); };
  return <form className="hero-search" role="search" onSubmit={submit}>
    <MapPin size={18} className="search-pin" />
    <input aria-label="Search places, food and experiences" placeholder="What would you like to discover in Kashi?" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-discovery-search" />
    <button type="submit" data-testid="button-discovery-search"><Search size={16} /><span>{buttonLabel}</span></button>
  </form>;
}

function FinderResults({ query, onClear }: { query: string; onClear: () => void }) {
  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return allDiscoveries.filter(item => `${item.title} ${item.subtitle} ${item.category} ${item.id}`.toLowerCase().includes(normalized)).slice(0, 6);
  }, [query]);
  if (!query) return null;
  return <div className="finder-panel" aria-live="polite">
    <div className="finder-heading"><div><span className="eyebrow">Your search</span><h3>Ideas for “{query}”</h3></div><button onClick={onClear} aria-label="Clear search results" data-testid="button-clear-search"><X size={17} /></button></div>
    {results.length > 0 ? <div className="finder-results">{results.map(item => <Link href={`/explore?q=${encodeURIComponent(item.title)}`} className="finder-result" key={item.id} data-testid={`result-search-${item.id}`}><span>{item.title}<small>{item.category} · {item.subtitle}</small></span><ArrowRight size={15} /></Link>)}</div> : <div className="no-results"><Search size={20} /><strong>No matches yet</strong><span>Try “ghat”, “food”, “stay” or “saree”.</span></div>}
    <p className="sample-disclaimer">{sampleNote}</p>
  </div>;
}

function Hero() {
  const [search, setSearch] = useState('');
  const chips = ['Hotels', 'Rooms under ₹500', 'Famous food', 'Kashi guide', 'Banarasi saree'];
  return <section className="hero-photo">
    <div className="hero-content page-shell">
      <div className="hero-copy fade-up">
        <div className="hero-kicker"><span /> A city with a thousand stories</div>
        <h1>Experience the<br /><em>Divine Kashi</em></h1>
        <p>Temples, ghats, food, craft and local stories.<br className="desktop-break" /> Find your own way into the city.</p>
        <SearchBox onSearch={setSearch} />
        <div className="hero-chips" aria-label="Popular searches">{chips.map((chip, index) => <button key={chip} onClick={() => setSearch(['stay', 'budget', 'food', 'experience', 'saree'][index])} data-testid={`chip-search-${chip.toLowerCase().replaceAll(' ', '-')}`}>{chip}</button>)}</div>
        <FinderResults query={search} onClear={() => setSearch('')} />
      </div>
      <div className="hero-caption"><span>25°18′N&nbsp; 83°00′E</span><i /> Ganga riverfront, Varanasi</div>
      <div className="hero-vertical">KASHI · THE ETERNAL CITY</div>
    </div>
  </section>;
}

function ShortcutStrip() {
  const destination = (label: string) => {
    const routes: Record<string, string> = {
      'Temples & Darshan': '/temples', 'Ghats & Ganga': '/ghats', 'Stay in Kashi': '/stays',
      'Food & Dining': '/food', 'Travel & Transport': '/travel', 'Spiritual Services': '/spiritual-services',
      'Guides & Experiences': '/guides', 'Shopping & Markets': '/shopping', 'Local Directory': '/local-businesses',
      'Events & Festivals': '/events',
    };
    return routes[label] ?? '/areas';
  };
  return <section className="shortcut-section page-shell" aria-label="Explore by category">
    <div className="shortcut-intro"><span className="eyebrow">Begin anywhere</span><p>Find your<br />Kashi.</p></div>
    <div className="shortcut-grid">{shortcuts.map((item, index) => {
      const Icon = shortcutIcons[item.icon];
      const href = item.label === 'My Kashi Trip' ? '/plan-my-trip' : destination(item.label);
      return <Link href={href} className="shortcut-item" key={item.label} data-testid={`shortcut-${item.icon}`} onClick={() => trackEvent('category_click', { category: href.replace(/\//g, '') })}>
        <span className={`shortcut-icon tone-${index % 4}`}><Icon size={19} strokeWidth={1.65} /></span><span>{item.label}</span>
      </Link>;
    })}</div>
  </section>;
}

function SectionTitle({ eyebrow, title, note, href, action = 'View all' }: { eyebrow: string; title: string; note: string; href: string; action?: string }) {
  return <div className="section-heading">
    <div><span className="eyebrow">{eyebrow}</span><h2 className="serif">{title}</h2><p>{note}</p></div>
    <Link href={href} className="view-link" data-testid={`link-view-${title.toLowerCase().replaceAll(' ', '-')}`}>{action}<ArrowUpRight size={15} /></Link>
  </div>;
}

function DiscoveryCard({ item, number, compact = false }: { item: Discovery; number: number; compact?: boolean }) {
  const categoryRoutes: Record<string, string> = { Stays: '/stays', Food: '/food', Spiritual: '/spiritual-services', Areas: '/areas', Experiences: '/guides', Shopping: '/shopping', Travel: '/travel', Events: '/events' };
  return <Link href={categoryRoutes[item.category] ?? '/explore'} className={`discovery-card ${compact ? 'compact-card' : ''}`} data-testid={`card-discovery-${item.id}`}>
    <div className="discovery-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,20,16,.57), transparent 72%), url("${asset(item.image ?? '/kashi-lanes.jpg')}")` }}>
      <span className="card-index">{String(number).padStart(2, '0')}</span>
      {item.label && <span className="card-label">{item.label}</span>}
      <span className="image-arrow"><ArrowUpRight size={15} /></span>
    </div>
    <div className="discovery-copy"><h3>{item.title}</h3><p>{item.subtitle}</p></div>
  </Link>;
}

function CardSection({ id, eyebrow, title, note, items, href, columns = 4, variant = '' }: { id: string; eyebrow: string; title: string; note: string; items: Discovery[]; href: string; columns?: number; variant?: string }) {
  return <section className={`content-section ${variant}`} id={id}>
    <div className="page-shell"><SectionTitle eyebrow={eyebrow} title={title} note={note} href={href} />
      <div className={`discovery-grid columns-${columns}`}>{items.map((item, index) => <DiscoveryCard key={item.id} item={item} number={index + 1} />)}</div>
      <p className="section-footnote">Sample discovery inspiration · confirm details locally</p>
    </div>
  </section>;
}

function StaySection() {
  const [stayType, setStayType] = useState('All stays');
  const visible = stayType === 'All stays' ? stays : stays.filter(item => item.title.toLowerCase().includes(stayType.split(' ')[0].toLowerCase()));
  return <section className="content-section stay-section" id="stays"><div className="page-shell">
    <SectionTitle eyebrow="Stay a little longer" title="Stay in Kashi" note="A place to rest, from simple pilgrim stays to heritage homes." href="/stays" />
    <div className="stay-controls" aria-label="Filter stay ideas">{['All stays', 'Budget', 'Luxury', 'Guest house', 'Homestay'].map(type => <button className={stayType === type ? 'active' : ''} onClick={() => setStayType(type)} key={type} data-testid={`filter-stays-${type.toLowerCase().replaceAll(' ', '-')}`}>{type}</button>)}</div>
    {visible.length ? <div className="discovery-grid columns-5 stay-grid">{visible.map((item, index) => <DiscoveryCard item={item} number={index + 1} key={item.id} />)}</div> : <div className="filter-empty">More {stayType.toLowerCase()} ideas are being gathered. <button onClick={() => setStayType('All stays')}>See all stay types</button></div>}
    <div className="stay-types"><span>Also explore</span>{['Dharamshalas', 'PG & hostels', 'Long-stay rentals', 'Family stays'].map(label => <Link href={`/explore?q=${encodeURIComponent(label)}`} key={label} data-testid={`link-stay-type-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}<ArrowRight size={13} /></Link>)}</div>
    <p className="section-footnote">Stay categories are illustrative. No availability or rates are represented.</p>
  </div></section>;
}

function ItineraryCallout() {
  return <section className="journey-panel page-shell" id="plan">
    <div className="journey-art" aria-hidden="true"><span className="sun-disc" /><div className="journey-river" /><span className="journey-stamp">काशी</span><span className="journey-art-note">A city best explored<br />one moment at a time.</span></div>
    <div className="journey-copy"><span className="eyebrow">The city, at your pace</span><h2 className="serif">Your Kashi.<br /><em>Your own rhythm.</em></h2><p>Start with a day, stay for a while, or simply follow your curiosity. A few thoughtful itinerary ideas can help you find a beginning.</p>
      <div className="journey-tags">{['1 day', '2 days', '3 days', 'Make it yours'].map((label, i) => <Link href={i === 3 ? '/plan-my-trip' : `/explore?q=${encodeURIComponent(label + ' itinerary')}`} key={label} data-testid={`link-itinerary-${i}`}>{label}<ArrowUpRight size={13} /></Link>)}</div>
      <Link href="/plan-my-trip" className="button-primary journey-cta" data-testid="link-plan-your-trip">Explore My Kashi Trip <ArrowRight size={16} /></Link>
      <small>Build, save and share a flexible outline · no booking or account needed</small>
    </div>
  </section>;
}

function InfoDialog({ topic, onClose }: { topic: string; onClose: () => void }) {
  if (!topic) return null;
  const message = topic === 'Privacy notice'
    ? 'Browsing needs no account. If you choose to register, we store your email, name and the details you add to your profile or business, protected so only you and authorised KashiNagri staff can access them. We count visits anonymously (pages viewed, searches with emails and numbers removed, clicks on listing contacts) without cookies or personal identifiers; Do Not Track and Global Privacy Control switch this off. Google Analytics cookies are used only if you accept them. There are no booking or payment flows.'
    : topic === 'Terms of use'
      ? 'Sample content is provided as discovery inspiration only. It is not a verified listing, travel guarantee, endorsement or substitute for confirming current information locally.'
      : topic === 'Social links'
        ? 'KashiNagri social channels are not connected in this preview. Follow along here when official channels are announced.'
        : 'This is a frontend preview. Submissions and direct contact channels are not enabled yet. KashiNagri will add a clear way to connect with local partners in a later release.';
  return <div className="modal-backdrop" onClick={onClose} role="presentation">
    <div className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={event => event.stopPropagation()}>
      <button className="dialog-close" onClick={onClose} aria-label="Close message" data-testid="button-close-dialog"><X size={18} /></button>
      <span className="eyebrow">KashiNagri preview</span><h2 id="dialog-title" className="serif">{topic}</h2>
      <p>{message}</p>
      <button className="button-primary" onClick={onClose} data-testid="button-dialog-done">Understood <Check size={15} /></button>
    </div>
  </div>;
}

function TrustAndPartner() {
  const [dialog, setDialog] = useState('');
  const trust = [
    { icon: Check, title: 'Verified information', text: 'A core principle of the guide; these sample ideas are not yet verified.' },
    { icon: MapPin, title: 'Local perspective', text: 'Neighbourhood context beyond a map pin.' },
    { icon: BookOpen, title: 'Easy to plan', text: 'Useful starting points, gathered in one place.' },
    { icon: HeartHandshake, title: 'All in one place', text: 'Stay, food, travel and culture in one guide.' },
  ];
  return <>
    <section className="trust-section"><div className="page-shell trust-grid">{trust.map(({ icon: Icon, title, text }) => <div className="trust-item" key={title}><span><Icon size={20} /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></section>
    <section className="partner-section page-shell">
      <div className="partner-mark"><Store size={26} strokeWidth={1.4} /></div>
      <div className="partner-copy"><span className="eyebrow">For the people who make Kashi</span><h2 className="serif">Your local story belongs here.</h2><p>Are you a guide, maker or local business? Tell us what you do and help shape a more useful city guide.</p></div>
      <div className="partner-actions"><Link href="/business/onboarding/" className="button-primary" data-testid="button-list-business">List your business <ArrowUpRight size={15} /></Link><button onClick={() => setDialog('Partner with KashiNagri')} className="partner-secondary" data-testid="button-partner">Partner with us <ArrowRight size={15} /></button></div>
      <span className="partner-disclaimer">Free account · every business is verified by our team before it appears publicly.</span>
    </section>
    <InfoDialog topic={dialog} onClose={() => setDialog('')} />
  </>;
}

export function Footer() {
  const [dialog, setDialog] = useState('');
  return <><footer className="site-footer"><div className="page-shell">
    <div className="footer-main"><div className="footer-brand"><Brand /><p>A thoughtful starting point for discovering the many layers of Kashi.</p><span className="footer-coordinate">25°18′N &nbsp; 83°00′E</span></div>
      <div className="footer-column"><strong>Discover</strong><Link href="/temples">Temples</Link><Link href="/ghats">Ghats & Ganga</Link><Link href="/food">Food & dining</Link><Link href="/stays">Places to stay</Link><Link href="/shopping">Markets & craft</Link></div>
      <div className="footer-column"><strong>Plan a visit</strong><Link href="/travel">Getting around</Link><Link href="/events">Events & festivals</Link><Link href="/guides">Local experiences</Link><Link href="/areas">Explore by area</Link><Link href="/plan-my-trip">My Kashi Trip</Link></div>
      <div className="footer-column"><strong>KashiNagri</strong><Link href="/local-businesses">Local directory</Link><Link href="/spiritual-services">Spiritual services</Link><button onClick={() => setDialog('Contact KashiNagri')} data-testid="button-footer-contact">Contact</button><button onClick={() => setDialog('Privacy notice')} data-testid="button-privacy">Privacy notice</button><button onClick={() => setDialog('Terms of use')} data-testid="button-terms">Terms of use</button></div>
    </div>
    <div className="footer-disclosure"><p><strong>A note on information</strong> — KashiNagri is a discovery concept. Sample content is illustrative, not a verified listing or endorsement. Please confirm current details, timings, safety and prices directly with local providers.</p><button onClick={() => setDialog('Share feedback')} data-testid="button-footer-feedback">Share feedback <ArrowUpRight size={13} /></button></div>
    <div className="footer-bottom"><span>© 2026 KashiNagri · Your Complete Guide to Kashi</span><span>Made with respect for the city and its people.</span><div className="footer-social"><button onClick={() => setDialog('Contact KashiNagri')} data-testid="button-social-contact">Contact</button><button onClick={() => setDialog('Social links')} data-testid="button-social-links">Social links <ArrowUpRight size={11} /></button></div></div>
  </div></footer><InfoDialog topic={dialog} onClose={() => setDialog('')} /></>;
}

/** Listings a super admin featured on the homepage. Renders nothing when none are featured. */
function FeaturedSection({ items }: { items: PublicCard[] }) {
  if (!items.length) return null;
  return <section className="content-section featured-section" id="featured"><div className="page-shell">
    <SectionTitle eyebrow="Reviewed by our team" title="Featured on KashiNagri" note="Verified local businesses and places our editors recommend." href="/local-businesses" action="Browse the directory" />
    <div className="discovery-grid columns-4">{items.map((item, index) => <Link href={`/listings/${item.slug}/`} className="discovery-card" key={item.id} data-testid={`card-featured-${item.slug}`}>
      <div className="discovery-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,20,16,.57), transparent 72%)${item.cover ? `, url("${item.cover}")` : `, url("${asset('/kashi-lanes.jpg')}")`}` }}>
        <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="card-label">{item.sponsoredLabel ?? (item.businessName ? 'Verified' : 'Curated')}</span>
        <span className="image-arrow"><ArrowUpRight size={15} /></span>
      </div>
      <div className="discovery-copy"><h3>{item.title}</h3><p>{item.summary ?? [item.subtype, item.area].filter(Boolean).join(' · ')}</p></div>
    </Link>)}</div>
  </div></section>;
}

export function HomePage({ featured = [] }: { featured?: PublicCard[] }) {
  return <><Header /><main><Hero /><ShortcutStrip /><FeaturedSection items={featured} /><StaySection />
    <div className="split-sections page-shell">
      <section className="mini-section" id="food"><SectionTitle eyebrow="Taste the city" title="Food & Dining" note="A morning bite, a long lunch, one more sweet." href="/food" /><div className="mini-grid">{foods.slice(0, 4).map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div><p className="section-footnote">Local discovery ideas · details may change</p></section>
      <section className="mini-section spiritual-mini" id="spiritual"><SectionTitle eyebrow="Meaning & ritual" title="Spiritual services" note="Learn what is offered, and how to take part respectfully." href="/spiritual-services" /><div className="mini-grid">{spiritual.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div><p className="section-footnote">Sample categories · confirm arrangements directly</p></section>
    </div>
      <CardSection id="areas" eyebrow="Find your corner" title="Explore Kashi by area" note="Every neighbourhood carries its own pace and point of view." items={areas} href="/areas" columns={6} />
    <ItineraryCallout />
    <div className="lower-discover page-shell">
      <section className="mini-section"><SectionTitle eyebrow="Go a little deeper" title="Guides & experiences" note="Meet the city through stories, walks and the river." href="/guides" /><div className="mini-grid">{experiences.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
      <section className="mini-section craft-mini"><SectionTitle eyebrow="Take a story home" title="Shopping in Kashi" note="Craft, colour and keepsakes with a sense of place." href="/shopping" /><div className="mini-grid">{shopping.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
    </div>
    <div className="lower-discover travel-events page-shell">
      <section className="mini-section"><SectionTitle eyebrow="Getting here, getting around" title="Travel & transport" note="A little orientation for arriving and moving through town." href="/travel" /><div className="mini-grid">{transport.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
      <section className="mini-section events-mini"><SectionTitle eyebrow="The city in celebration" title="Events & festivals" note="Rituals and gatherings that give the calendar its rhythm." href="/events" /><div className="mini-grid">{events.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
    </div>
    <TrustAndPartner />
  </main><Footer /></>;
}
