 'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, ArrowUpRight, BedDouble, BookOpen, CalendarDays,
  Check, ChevronDown, Compass, Flower2, Globe2, HeartHandshake, Map, MapPin, Menu,
  CircleUserRound,
  Navigation, Search, ShoppingBag, Sparkles, Store, TrainFront, Utensils, Waves, X,
} from 'lucide-react';
import {
  allDiscoveries, areas, events, experiences, foods, itineraries, sampleNote, shortcuts,
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

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'हिं'>('EN');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState(false);
  const router = useRouter();
  const [topQuery, setTopQuery] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/explore?q=${encodeURIComponent(topQuery.trim())}`);
    setMenuOpen(false);
  };
  const navGroups = [
    { name: 'Temples & Darshan', choices: ['Kashi Vishwanath', 'Temple etiquette', 'Darshan guide'] },
    { name: 'Ghats & Ganga', choices: ['Explore the ghats', 'Ganga Aarti', 'River journeys'] },
    { name: 'Stay in Kashi', choices: ['Budget rooms', 'Heritage stays', 'Homestays'] },
    { name: 'Food & Dining', choices: ['Street food', 'Traditional thali', 'Cafés'] },
    { name: 'Travel', choices: ['Getting around', 'Railway connections', 'Airport arrivals'] },
    { name: 'Shopping', choices: ['Banarasi sarees', 'Handicrafts', 'Local markets'] },
    { name: 'Spiritual Services', choices: ['Puja & path', 'Pandit & purohit', 'Jyotish'] },
    { name: 'Guides', choices: ['Temple walks', 'Food walks', 'Ghat stories'] },
    { name: 'Events', choices: ['Festivals', 'Ganga Aarti', 'Seasonal calendar'] },
    { name: 'More', choices: ['Local directory', 'My Kashi Trip', 'About KashiNagri'] },
  ];
  const routeFor = (label: string) => label === 'My Kashi Trip' ? '/plan-my-trip' : `/explore?q=${encodeURIComponent(label)}`;
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
        <button className="account-link account-button" onClick={() => setAccountInfo(true)} aria-label="Login or register" data-testid="button-login-register"><CircleUserRound size={19} /><span>Login / Register</span></button>
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
            {group.choices.map(choice => <Link key={choice} href={routeFor(choice)} onClick={() => { setActiveDropdown(null); setMenuOpen(false); }} data-testid={`link-menu-${choice.toLowerCase().replaceAll(' ', '-')}`}>{choice}<ArrowUpRight size={13} /></Link>)}
          </div>}
        </div>)}
        <Link href="/plan-my-trip" className="nav-trip" onClick={() => setMenuOpen(false)} data-testid="link-nav-trip">My Kashi Trip <ArrowUpRight size={13} /></Link>
      </div>
    </nav>
    {activeDropdown && <button className="menu-scrim" onClick={() => setActiveDropdown(null)} aria-label="Close navigation dropdown" />}
    <InfoDialog topic={accountInfo ? 'Login / Register' : ''} onClose={() => setAccountInfo(false)} />
  </header>;
}

function SearchBox({ initial = '', onSearch, buttonLabel = 'Explore Kashi' }: { initial?: string; onSearch: (value: string) => void; buttonLabel?: string }) {
  const [query, setQuery] = useState(initial);
  const submit = (event: FormEvent) => { event.preventDefault(); onSearch(query.trim()); };
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
  return <section className="shortcut-section page-shell" aria-label="Explore by category">
    <div className="shortcut-intro"><span className="eyebrow">Begin anywhere</span><p>Find your<br />Kashi.</p></div>
    <div className="shortcut-grid">{shortcuts.map((item, index) => {
      const Icon = shortcutIcons[item.icon];
      const href = item.label === 'My Kashi Trip' ? '/plan-my-trip' : `/explore?q=${encodeURIComponent(item.query)}`;
      return <Link href={href} className="shortcut-item" key={item.label} data-testid={`shortcut-${item.icon}`}>
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
  return <Link href={`/explore?q=${encodeURIComponent(item.title)}`} className={`discovery-card ${compact ? 'compact-card' : ''}`} data-testid={`card-discovery-${item.id}`}>
    <div className="discovery-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,20,16,.57), transparent 72%), url("${item.image ?? '/kashi-lanes.jpg'}")` }}>
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
    <SectionTitle eyebrow="Stay a little longer" title="Stay in Kashi" note="A place to rest, from simple pilgrim stays to heritage homes." href="/explore?category=stays" />
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
      <small>Preview only · a personal trip planner is coming in a later release</small>
    </div>
  </section>;
}

function InfoDialog({ topic, onClose }: { topic: string; onClose: () => void }) {
  if (!topic) return null;
  const message = topic === 'Login / Register'
    ? 'Account access is not part of this preview. There is no sign-in, registration, or personal profile data collected here.'
    : topic === 'Privacy notice'
    ? 'This preview stores no account or personal profile data. Search and filters are handled in your browser; there are no booking, payment or sign-in flows.'
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
      <div className="partner-actions"><button onClick={() => setDialog('List your business')} className="button-primary" data-testid="button-list-business">List your business <ArrowUpRight size={15} /></button><button onClick={() => setDialog('Partner with KashiNagri')} className="partner-secondary" data-testid="button-partner">Partner with us <ArrowRight size={15} /></button></div>
      <span className="partner-disclaimer">Enquiries only · no listings are submitted or verified through this preview.</span>
    </section>
    <InfoDialog topic={dialog} onClose={() => setDialog('')} />
  </>;
}

function Footer() {
  const [dialog, setDialog] = useState('');
  return <><footer className="site-footer"><div className="page-shell">
    <div className="footer-main"><div className="footer-brand"><Brand /><p>A thoughtful starting point for discovering the many layers of Kashi.</p><span className="footer-coordinate">25°18′N &nbsp; 83°00′E</span></div>
      <div className="footer-column"><strong>Discover</strong><Link href="/explore?q=temple">Temples & ghats</Link><Link href="/explore?q=food">Food & dining</Link><Link href="/explore?q=stay">Places to stay</Link><Link href="/explore?q=shopping">Markets & craft</Link></div>
      <div className="footer-column"><strong>Plan a visit</strong><Link href="/explore?q=transport">Getting around</Link><Link href="/explore?q=festival">Events & festivals</Link><Link href="/explore?q=guide">Local experiences</Link><Link href="/plan-my-trip">My Kashi Trip</Link></div>
      <div className="footer-column"><strong>KashiNagri</strong><Link href="/explore?q=kashi">About the guide</Link><button onClick={() => setDialog('Contact KashiNagri')} data-testid="button-footer-contact">Contact</button><button onClick={() => setDialog('Privacy notice')} data-testid="button-privacy">Privacy notice</button><button onClick={() => setDialog('Terms of use')} data-testid="button-terms">Terms of use</button></div>
    </div>
    <div className="footer-disclosure"><p><strong>A note on information</strong> — KashiNagri is a discovery concept. Sample content is illustrative, not a verified listing or endorsement. Please confirm current details, timings, safety and prices directly with local providers.</p><button onClick={() => setDialog('Share feedback')} data-testid="button-footer-feedback">Share feedback <ArrowUpRight size={13} /></button></div>
    <div className="footer-bottom"><span>© 2026 KashiNagri · Your Complete Guide to Kashi</span><span>Made with respect for the city and its people.</span><div className="footer-social"><button onClick={() => setDialog('Contact KashiNagri')} data-testid="button-social-contact">Contact</button><button onClick={() => setDialog('Social links')} data-testid="button-social-links">Social links <ArrowUpRight size={11} /></button></div></div>
  </div></footer><InfoDialog topic={dialog} onClose={() => setDialog('')} /></>;
}

export function HomePage() {
  return <><Header /><main><Hero /><ShortcutStrip /><StaySection />
    <div className="split-sections page-shell">
      <section className="mini-section" id="food"><SectionTitle eyebrow="Taste the city" title="Food & Dining" note="A morning bite, a long lunch, one more sweet." href="/explore?category=food" /><div className="mini-grid">{foods.slice(0, 4).map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div><p className="section-footnote">Local discovery ideas · details may change</p></section>
      <section className="mini-section spiritual-mini" id="spiritual"><SectionTitle eyebrow="Meaning & ritual" title="Spiritual services" note="Learn what is offered, and how to take part respectfully." href="/explore?category=spiritual" /><div className="mini-grid">{spiritual.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div><p className="section-footnote">Sample categories · confirm arrangements directly</p></section>
    </div>
    <CardSection id="areas" eyebrow="Find your corner" title="Explore Kashi by area" note="Every neighbourhood carries its own pace and point of view." items={areas} href="/explore?category=areas" columns={6} />
    <ItineraryCallout />
    <div className="lower-discover page-shell">
      <section className="mini-section"><SectionTitle eyebrow="Go a little deeper" title="Guides & experiences" note="Meet the city through stories, walks and the river." href="/explore?category=experiences" /><div className="mini-grid">{experiences.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
      <section className="mini-section craft-mini"><SectionTitle eyebrow="Take a story home" title="Shopping in Kashi" note="Craft, colour and keepsakes with a sense of place." href="/explore?category=shopping" /><div className="mini-grid">{shopping.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
    </div>
    <div className="lower-discover travel-events page-shell">
      <section className="mini-section"><SectionTitle eyebrow="Getting here, getting around" title="Travel & transport" note="A little orientation for arriving and moving through town." href="/explore?category=travel" /><div className="mini-grid">{transport.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
      <section className="mini-section events-mini"><SectionTitle eyebrow="The city in celebration" title="Events & festivals" note="Rituals and gatherings that give the calendar its rhythm." href="/explore?category=events" /><div className="mini-grid">{events.map((item, i) => <DiscoveryCard item={item} number={i + 1} compact key={item.id} />)}</div></section>
    </div>
    <TrustAndPartner />
  </main><Footer /></>;
}

export function ExplorePage() {
  const searchParams = useSearchParams();
  const routeQuery = searchParams?.get('q') ?? searchParams?.get('category') ?? '';
  const [query, setQuery] = useState(routeQuery);
  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('Curated ideas');
  const categories = ['All', 'Stays', 'Food', 'Spiritual', 'Areas', 'Itineraries', 'Experiences', 'Shopping', 'Travel', 'Events'];
  const filtered = useMemo(() => {
    const matches = allDiscoveries.filter(item => {
      const categoryMatch = category === 'All' || item.category.toLowerCase() === category.toLowerCase();
      const q = query.trim().toLowerCase();
      const queryMatch = !q || `${item.title} ${item.subtitle} ${item.category} ${item.id}`.toLowerCase().includes(q);
      return categoryMatch && queryMatch;
    });
    return sort === 'A to Z' ? [...matches].sort((a, b) => a.title.localeCompare(b.title)) : matches;
  }, [category, query, sort]);
  const submit = (value: string) => setQuery(value);
  return <><Header /><main className="explore-page">
    <section className="explore-intro page-shell"><div><span className="eyebrow">Kashi, by your curiosity</span><h1 className="serif">Explore the city<br /><em>one discovery at a time.</em></h1><p>Browse sample ideas across neighbourhoods, flavours, stays and experiences. These are starting points—not verified listings.</p></div>
      <div className="explore-search-wrap"><SearchBox key={query} initial={query} onSearch={submit} buttonLabel="Search" /></div>
    </section>
    <section className="explore-body page-shell">
      <div className="map-panel"><div className="map-top-label"><Map size={16} /> Kashi, seen as a living map <span>Illustrative map view</span></div>
        <div className="map-paper"><div className="river-ribbon"><span>GANGA</span></div>
          {[['Vishwanath Gali','24%','28%'], ['Godowlia','53%','43%'], ['Assi Ghat','34%','76%'], ['Lanka & BHU','72%','72%'], ['Cantt','75%','20%']].map(([name, left, top], index) => <Link href={`/explore?q=${encodeURIComponent(name)}`} key={name} className={`map-pin pin-${index}`} style={{ left, top }} data-testid={`map-pin-${index}`}><span className="pin-dot"><MapPin size={15} fill="currentColor" /></span><strong>{name}</strong></Link>)}
          <span className="map-legend">North ↑</span><span className="map-mapnote">River bends. Stories gather.</span>
        </div>
      </div>
      <div className="results-side"><div className="results-head"><div><span className="eyebrow">Browse discoveries</span><h2 className="serif">{filtered.length} <em>ideas to begin with</em></h2></div><label className="sort-label">Showing <select aria-label="Sort discovery ideas" value={sort} onChange={event => setSort(event.target.value)} data-testid="select-sort"><option>Curated ideas</option><option>A to Z</option></select></label></div>
        <div className="category-filters" aria-label="Filter by category">{categories.map(item => <button className={category === item ? 'selected' : ''} key={item} onClick={() => setCategory(item)} data-testid={`filter-explore-${item.toLowerCase()}`}>{item}</button>)}</div>
        <p className="result-count" aria-live="polite">{filtered.length} sample {filtered.length === 1 ? 'idea' : 'ideas'}{query && <> matching <strong>“{query}”</strong></>}</p>
        {filtered.length ? <div className="explore-results">{filtered.map((item, i) => <DiscoveryCard item={item} number={i + 1} key={item.id} />)}</div> : <div className="empty-discover"><span><Compass size={24} /></span><h3>No discoveries found</h3><p>Try a broader word, or clear filters to see more ways into Kashi.</p><button onClick={() => { setQuery(''); setCategory('All'); }} data-testid="button-clear-filters">Clear search and filters <ArrowRight size={15} /></button></div>}
        <p className="sample-disclaimer explore-disclaimer">{sampleNote}</p>
      </div>
    </section>
    <section className="explore-trip-cta page-shell"><div><span className="eyebrow">Have a few days?</span><h2 className="serif">Make space for your own Kashi.</h2><p>Explore itinerary ideas before you decide on your pace.</p></div><Link href="/plan-my-trip" className="button-primary" data-testid="link-explore-plan-trip">Preview My Kashi Trip <ArrowRight size={16} /></Link></section>
  </main><Footer /></>;
}

export function PlanPreviewPage() {
  return <><Header /><main className="plan-preview page-shell">
    <div className="plan-back"><Link href="/" data-testid="link-back-home"><ArrowRight size={14} /> Back to KashiNagri</Link><span className="eyebrow">A preview, not a planner—yet</span></div>
    <section className="plan-hero"><div className="plan-hero-copy"><span className="eyebrow">My Kashi Trip</span><h1 className="serif">Let the city<br /><em>find its way in.</em></h1><p>A considered first outline for your time in Kashi. The complete personal trip builder is planned for a future release; for now, begin with a few sample rhythms.</p><Link href="/explore?category=itineraries" className="button-primary" data-testid="link-see-itinerary-ideas">Explore itinerary ideas <ArrowRight size={16} /></Link></div><div className="plan-image"><span>काशी</span><small>Take your time.</small></div></section>
    <section className="plan-days"><SectionTitle eyebrow="Choose a starting point" title="A few ways to begin" note="Illustrative day shapes—not fixed schedules or promises." href="/explore?category=itineraries" action="Browse all ideas" /><div className="plan-card-grid">{itineraries.map((item, i) => <DiscoveryCard item={item} number={i + 1} key={item.id} />)}</div></section>
    <div className="preview-note"><Sparkles size={18} /><div><strong>What this preview is</strong><p>A small taste of itinerary inspiration. No booking, account, saved trip or live availability features are active here.</p></div></div>
  </main><Footer /></>;
}

export default function App() {
  return <HomePage />;
}
