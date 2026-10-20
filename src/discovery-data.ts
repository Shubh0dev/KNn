export type CategorySlug =
  | 'temples' | 'ghats' | 'stays' | 'food' | 'travel' | 'shopping'
  | 'spiritual-services' | 'guides' | 'events' | 'local-businesses' | 'areas';

export type DiscoveryCategory = {
  slug: CategorySlug;
  title: string;
  eyebrow: string;
  intro: string;
  image: string;
  imageAlt: string;
  filters: string[];
  related: CategorySlug[];
};

export type DiscoveryItem = {
  slug: string;
  category: CategorySlug;
  title: string;
  subtitle: string;
  overview: string;
  context: string;
  image: string;
  imageAlt: string;
  tags: string[];
  area?: string;
  stayType?: string;
  budgetBand?: 'Value' | 'Comfort' | 'Premium';
  roomTypes?: string[];
  amenities?: string[];
};

export const demoNotice = 'Illustrative demo content · not a verified listing. Please confirm current details independently before making plans.';

export const categories: DiscoveryCategory[] = [
  { slug: 'temples', title: 'Temples of Kashi', eyebrow: 'Sacred spaces', intro: 'A considerate starting point for learning about the city’s temple traditions, the places that shape its lanes, and how to approach a visit with care.', image: '/kashi-lanes.jpg', imageAlt: 'A narrow old-city lane with temple architecture', filters: ['Temple visits', 'Ritual & etiquette', 'History'], related: ['ghats', 'spiritual-services', 'guides'] },
  { slug: 'ghats', title: 'Along the ghats', eyebrow: 'Riverfront & rituals', intro: 'The riverfront is both a place of daily life and a setting for ceremony. Begin with its changing moods, shared spaces and many ways of looking.', image: '/kashi-riverfront.jpg', imageAlt: 'Varanasi riverfront at dusk', filters: ['Riverfront', 'Rituals', 'Quiet moments'], related: ['temples', 'guides', 'areas'] },
  { slug: 'stays', title: 'Stay in Kashi', eyebrow: 'Find your resting place', intro: 'From a simple room to a slower, more considered stay, explore the kinds of accommodation visitors may look for. These sample categories are illustrative—not live properties.', image: '/kashi-riverfront.jpg', imageAlt: 'Riverfront buildings in the evening light', filters: ['Hotels', 'Dharamshalas', 'Guest houses', 'Hostels', 'Homestays', 'Rentals'], related: ['areas', 'travel', 'guides'] },
  { slug: 'food', title: 'A taste of Kashi', eyebrow: 'Food & everyday culture', intro: 'Follow the city through breakfast counters, small plates, sweets and cups of chai. These ideas describe food traditions, not verified venues.', image: '/kashi-food.jpg', imageAlt: 'Local snacks served in earthen bowls', filters: ['Street food', 'Meals', 'Sweets', 'Cafés'], related: ['areas', 'guides', 'shopping'] },
  { slug: 'travel', title: 'Getting to know the way', eyebrow: 'Travel & orientation', intro: 'A little context can make arrivals and everyday movement feel easier. Start with transport topics and leave room for conditions to change.', image: '/kashi-lanes.jpg', imageAlt: 'A busy lane through the old city', filters: ['Arrivals', 'Getting around', 'River journeys'], related: ['areas', 'ghats', 'stays'] },
  { slug: 'shopping', title: 'Craft, markets & keepsakes', eyebrow: 'Made and found here', intro: 'Explore the craft traditions, devotional essentials and market culture that give Kashi its colours and textures.', image: '/kashi-craft.jpg', imageAlt: 'A weaver at work on a richly patterned textile', filters: ['Textiles', 'Craft', 'Markets', 'Devotional'], related: ['areas', 'local-businesses', 'guides'] },
  { slug: 'spiritual-services', title: 'Rituals & spiritual services', eyebrow: 'Meaning & practice', intro: 'A respectful orientation to common ritual categories and spiritual practices. Arrangements and customs vary; learn what matters to you before taking part.', image: '/kashi-riverfront.jpg', imageAlt: 'Riverfront steps at dusk', filters: ['Puja & path', 'Guidance', 'Astrology'], related: ['temples', 'ghats', 'guides'] },
  { slug: 'guides', title: 'See Kashi with context', eyebrow: 'Guides & experiences', intro: 'Walks, stories and ways of seeing can bring a place into focus. Browse experience ideas while remembering that no guide or service here is verified.', image: '/kashi-lanes.jpg', imageAlt: 'A sunlit lane in Varanasi', filters: ['Walking', 'Food', 'Riverfront', 'Stories'], related: ['temples', 'ghats', 'food'] },
  { slug: 'events', title: 'The city in its seasons', eyebrow: 'Events & gatherings', intro: 'Rituals, festivals and public gatherings shape the calendar. Treat these as orientation topics only; dates, access and programmes can change.', image: '/kashi-riverfront.jpg', imageAlt: 'The ghats illuminated at twilight', filters: ['Festivals', 'Daily rituals', 'Seasonal'], related: ['ghats', 'temples', 'guides'] },
  { slug: 'local-businesses', title: 'Local makers & services', eyebrow: 'A city made by people', intro: 'A future directory can connect visitors with local makers and useful services. For now, browse illustrative themes—not live businesses or contacts.', image: '/kashi-craft.jpg', imageAlt: 'Banarasi textile being woven by hand', filters: ['Makers', 'Food', 'Craft'], related: ['shopping', 'food', 'guides'] },
  { slug: 'areas', title: 'Find your corner of Kashi', eyebrow: 'Neighbourhood notes', intro: 'Each part of the city offers a different pace and perspective. Use these area notes to begin orienting yourself, not as precise directions.', image: '/kashi-lanes.jpg', imageAlt: 'The old city’s narrow lanes', filters: ['Old city', 'Riverfront', 'South Kashi'], related: ['ghats', 'food', 'stays'] },
];

function item(slug: string, category: CategorySlug, title: string, subtitle: string, overview: string, context: string, image: string, tags: string[], area?: string): DiscoveryItem {
  return { slug, category, title, subtitle, overview, context, image, imageAlt: `${title} — illustrative view of Kashi`, tags, area };
}

export const items: DiscoveryItem[] = [
  item('kashi-vishwanath', 'temples', 'Kashi Vishwanath: a first orientation', 'Temple visit · Old city', 'An introductory note for visitors curious about one of Kashi’s best-known sacred places.', 'Consider reading current visitor guidance before you go. Practices, access arrangements and crowd conditions are not represented here.', '/kashi-lanes.jpg', ['Temple visits', 'History', 'Old city']),
  item('temple-etiquette', 'temples', 'Approaching a temple visit', 'Etiquette · A thoughtful beginning', 'A gentle overview of ways to prepare for a temple visit with respect for worshippers and local customs.', 'Dress, photography, entry and security rules differ from place to place. Check current guidance and follow instructions on site.', '/kashi-lanes.jpg', ['Ritual & etiquette', 'Temple visits']),
  item('small-shrines', 'temples', 'Shrines in the old lanes', 'Temple visits · Everyday devotion', 'A theme for noticing the smaller shrines woven into neighbourhood life.', 'Move thoughtfully through active places of worship and avoid interrupting prayer or local routines.', '/kashi-lanes.jpg', ['Temple visits', 'Old city']),
  item('riverfront-at-dusk', 'ghats', 'The riverfront at dusk', 'Ghat-side atmosphere', 'A visual introduction to the ghats as the light changes and the riverfront takes on an evening rhythm.', 'This is a discovery prompt, not a promise of a particular ceremony, view or operating schedule.', '/kashi-riverfront.jpg', ['Riverfront', 'Quiet moments']),
  item('reading-the-ghats', 'ghats', 'Reading the river steps', 'Architecture · Everyday life', 'Look for the many uses of the river steps: movement, meeting, ritual and a close relationship with the water.', 'The riverfront is an active shared space. Follow local notices and take care around steps and water.', '/kashi-riverfront.jpg', ['Riverfront', 'Stories']),
  item('aarti-as-ritual', 'ghats', 'Aarti as a shared ritual', 'Ritual · Learn before you go', 'An introduction to the meaning and atmosphere of aarti along the river.', 'Locations, crowd levels and schedules can vary. This guide does not publish timings.', '/kashi-riverfront.jpg', ['Rituals', 'Riverfront']),
  ...([
    ['value-rooms', 'Simple rooms', 'A practical starting point for a shorter visit', 'Value', 'Guest houses'],
    ['heritage-inspired-stay', 'Heritage-inspired stay', 'Characterful details and a slower pace', 'Comfort', 'Hotels'],
    ['room-to-unwind', 'Room to unwind', 'More space for a considered city break', 'Premium', 'Hotels'],
    ['pilgrim-rest', 'Pilgrim accommodation', 'A simple stay idea for a spiritually focused visit', 'Value', 'Dharamshalas'],
    ['neighbourhood-guesthouse', 'Neighbourhood guest house', 'A smaller-scale stay concept', 'Comfort', 'Guest houses'],
    ['shared-stay', 'Shared stay', 'A social, practical option for independent visitors', 'Value', 'Hostels'],
    ['longer-stay-home', 'Longer-stay home', 'A home-like base for spending more time in the city', 'Comfort', 'Rentals'],
    ['local-homestay', 'Local homestay', 'A home-style stay concept rooted in neighbourhood life', 'Comfort', 'Homestays'],
    ['river-nearby-stay', 'Riverfront stay idea', 'A way to think about being close to the water', 'Premium', 'Hotels'],
  ] as const).map(([slug, title, subtitle, budgetBand, stayType], index) => ({
    ...item(slug, 'stays', title, subtitle, `${subtitle}. This is a sample accommodation category to help shape your search.`, 'No property, room, rate or availability is represented. Confirm any stay directly through a trusted provider.', index % 2 ? '/kashi-lanes.jpg' : '/kashi-riverfront.jpg', [stayType, budgetBand, 'Illustrative'], index % 3 === 0 ? 'Old city' : index % 3 === 1 ? 'Assi side' : 'Area not specified'),
    stayType,
    budgetBand,
    roomTypes: index % 2 ? ['Double', 'Family'] : ['Single', 'Double'],
    amenities: index % 3 ? ['Wi-Fi', 'Air conditioning'] : ['Breakfast', 'River view'],
  })),
  item('morning-kachori', 'food', 'A morning of kachori and sabzi', 'Street food · Breakfast tradition', 'A familiar breakfast idea that offers a hearty introduction to the city’s food culture.', 'This is a food tradition, not a recommendation for a specific shop. Ingredients and availability vary.', '/kashi-food.jpg', ['Street food', 'Meals']),
  item('chaat-and-lanes', 'food', 'Chaat through the lanes', 'Street food · Small plates', 'Explore the balance of spice, crunch and tang that makes chaat such a beloved street-food format.', 'No vendor or hygiene standard is being endorsed. Choose food thoughtfully and check what suits your needs.', '/kashi-food.jpg', ['Street food', 'Old city']),
  item('kashi-sweets', 'food', 'Sweets and seasonal treats', 'Sweets · A little indulgence', 'From crisp jalebi to soft, seasonal specialities, sweets are part of the city’s everyday pleasures.', 'Seasonality and availability change; this sample does not identify a specific seller.', '/kashi-food.jpg', ['Sweets']),
  item('chai-pause', 'food', 'A pause for chai', 'Cafés & tea · Take it slow', 'Make room for an unhurried cup and watch the neighbourhood move around you.', 'This is a general idea rather than a venue listing.', '/kashi-riverfront.jpg', ['Cafés', 'Quiet moments']),
  item('arriving-by-rail', 'travel', 'Arriving by rail', 'Arrival orientation', 'A starting point for thinking through your onward journey after reaching the city by train.', 'Station services, routes and traffic conditions can change; consult current transport sources.', '/kashi-lanes.jpg', ['Arrivals']),
  item('moving-through-lanes', 'travel', 'Moving through the lanes', 'Getting around · Walk with care', 'The old city is best approached at a human pace, with attention to narrow paths and changing activity.', 'Route access and walking conditions are not guaranteed. Follow local guidance.', '/kashi-lanes.jpg', ['Getting around', 'Old city']),
  item('river-journey-context', 'travel', 'A river journey, considered', 'River journeys · Safety first', 'An orientation to seeing the ghats from the water and the different perspective a river journey can offer.', 'No operator, route, price, safety provision or availability is represented. Verify everything before booking.', '/kashi-riverfront.jpg', ['River journeys']),
  item('banarasi-weaving', 'shopping', 'The language of Banarasi weaving', 'Textiles · Craft tradition', 'Learn about the intricate patterns and skilled handwork associated with Banarasi textiles.', 'This is a craft introduction, not a seller, provenance or authenticity claim.', '/kashi-craft.jpg', ['Textiles', 'Craft']),
  item('market-wander', 'shopping', 'A thoughtful market wander', 'Markets · Go with curiosity', 'Browse the textures, sounds and everyday rhythms of a local market without needing a fixed shopping list.', 'Market conditions and business details are not verified.', '/kashi-lanes.jpg', ['Markets']),
  item('devotional-keepsakes', 'shopping', 'Devotional objects & essentials', 'Devotional · Buy with care', 'A prompt to learn what devotional objects mean before choosing something to take home.', 'Customs and materials vary. Ask questions and buy respectfully.', '/kashi-craft.jpg', ['Devotional', 'Craft']),
  item('puja-basics', 'spiritual-services', 'Understanding puja', 'Ritual & etiquette', 'An introductory guide to the place of puja in everyday spiritual practice.', 'Rituals are personal and traditions differ. This is not a service offer or instruction for a specific ceremony.', '/kashi-riverfront.jpg', ['Puja & path']),
  item('finding-spiritual-guidance', 'spiritual-services', 'Seeking spiritual guidance', 'Guidance · Make informed choices', 'A thoughtful starting point for visitors considering a conversation with a spiritual practitioner.', 'No individual practitioner is listed or endorsed. Agree on expectations and any arrangements directly.', '/kashi-lanes.jpg', ['Guidance']),
  item('jyotish-context', 'spiritual-services', 'Jyotish in context', 'Astrology · A cultural introduction', 'Learn about Jyotish as a longstanding tradition and part of the region’s spiritual landscape.', 'This is cultural context, not a personal reading or claim of predictive accuracy.', '/kashi-lanes.jpg', ['Astrology']),
  item('old-city-walk', 'guides', 'A walk through the old city', 'Walking · Lanes and layers', 'A self-guided theme for noticing architecture, shrines, sounds and the everyday movement of the old lanes.', 'Paths can be busy and changeable. Respect residents and active places of worship.', '/kashi-lanes.jpg', ['Walking', 'Stories']),
  item('food-culture-walk', 'guides', 'Follow the flavours', 'Food · A neighbourhood lens', 'Let familiar foods tell a story about ingredients, habits and the city’s daily pace.', 'This is an experience idea only; no guide or venue is listed.', '/kashi-food.jpg', ['Food', 'Walking']),
  item('river-stories', 'guides', 'Stories along the river', 'Riverfront · A slower look', 'Consider the ghats through their architecture, rituals and everyday role in city life.', 'This sample does not represent a guided service or scheduled event.', '/kashi-riverfront.jpg', ['Riverfront', 'Stories']),
  item('dev-deepawali-context', 'events', 'Dev Deepawali: a seasonal gathering', 'Festival · Riverfront', 'A starting point for learning about a celebrated seasonal moment on the riverfront.', 'Dates, access and arrangements vary by year. Check current local guidance before travelling.', '/kashi-riverfront.jpg', ['Festivals', 'Seasonal']),
  item('mahashivratri-context', 'events', 'Mahashivratri in Kashi', 'Festival · Devotion', 'An introduction to the significance of this major night of devotion in the city.', 'This is not a current event notice. Dates, crowd conditions and access are not represented.', '/kashi-lanes.jpg', ['Festivals', 'Seasonal']),
  item('daily-aarti-context', 'events', 'Aarti: an evening ritual', 'Daily ritual · Learn the context', 'Understand the place of aarti in the rhythms of worship and riverfront life.', 'No timing or location is promised; verify current information locally.', '/kashi-riverfront.jpg', ['Daily rituals']),
  item('weaving-community', 'local-businesses', 'Textile makers & weaving', 'Makers · Craft', 'Explore how weaving shapes the cultural and working life of the region.', 'No maker, workshop, product or contact details are listed in this illustrative preview.', '/kashi-craft.jpg', ['Makers', 'Craft']),
  item('local-food-spaces', 'local-businesses', 'Independent food spaces', 'Food · Everyday discoveries', 'A future directory could help visitors discover small food businesses across the city.', 'This is a directory theme, not a live business or recommendation.', '/kashi-food.jpg', ['Food']),
  item('old-city-area', 'areas', 'The old city', 'Lanes · Temples · Markets', 'A dense, layered part of Kashi where narrow lanes connect sacred places, shops and everyday neighbourhood life.', 'The lane network is complex; use local wayfinding and allow extra time.', '/kashi-lanes.jpg', ['Old city']),
  item('assi-side-area', 'areas', 'Assi and the southern riverfront', 'Riverfront · A different pace', 'An area lens for discovering a more southerly stretch of the city and its relationship with the river.', 'Area descriptions are broad orientation only, not a precise map or guarantee of amenities.', '/kashi-riverfront.jpg', ['Riverfront', 'South Kashi']),
  item('godowlia-area', 'areas', 'Godowlia and the busy centre', 'Markets · Movement', 'A starting point for navigating one of the city’s energetic commercial crossroads.', 'Traffic and pedestrian conditions can shift throughout the day.', '/kashi-lanes.jpg', ['Old city', 'Markets']),
  item('lanka-bhu-area', 'areas', 'Lanka and the southern city', 'Campus life · South Kashi', 'A neighbourhood lens on the southern side of Varanasi and its academic and everyday culture.', 'No specific venue or boundary is implied by this sample description.', '/kashi-lanes.jpg', ['South Kashi']),
];

export const getCategory = (slug: string) => categories.find((category) => category.slug === slug);
export const getItems = (slug: CategorySlug) => items.filter((item) => item.category === slug);
export const getItem = (slug: string) => items.find((item) => item.slug === slug);
export const parentPath = (category: CategorySlug) => `/${category}/`;
export const categoryMetadata = (slug: CategorySlug) => {
  const category = getCategory(slug)!;
  return { title: `${category.title} | KashiNagri`, description: `${category.intro} Browse illustrative, unverified discovery ideas from KashiNagri.` };
};
