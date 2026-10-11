import { items, type DiscoveryItem } from './discovery-data';

export type TripLength = 'half' | 'one' | 'two' | 'three';
export type BudgetLens = 'economical' | 'comfortable' | 'premium';
export type TripPace = 'relaxed' | 'packed';
export type Interest = 'temples' | 'ghats' | 'food' | 'history' | 'shopping' | 'crafts' | 'local-experiences';

export type TripPreferences = {
  length: TripLength;
  budget: BudgetLens;
  interests: Interest[];
  area: string;
  pace: TripPace;
};

export type ItineraryStop =
  | { kind: 'discovery'; time: string; item: DiscoveryItem; reason: string }
  | { kind: 'break'; time: string; title: string; reason: string };

export type ItineraryDay = { number: number; theme: string; stops: ItineraryStop[] };

export const interestOptions: { value: Interest; label: string }[] = [
  { value: 'temples', label: 'Temples' },
  { value: 'ghats', label: 'Ghats' },
  { value: 'food', label: 'Food' },
  { value: 'history', label: 'History' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'crafts', label: 'Crafts' },
  { value: 'local-experiences', label: 'Local experiences' },
];

export const lengthOptions: { value: TripLength; label: string }[] = [
  { value: 'half', label: 'Half-day' },
  { value: 'one', label: 'One day' },
  { value: 'two', label: 'Two days' },
  { value: 'three', label: 'Three days' },
];

export const budgetLabels: Record<BudgetLens, string> = {
  economical: 'Economical',
  comfortable: 'Comfortable',
  premium: 'Premium',
};

export const areaNeighbours: Record<string, string[]> = {
  'old-city-area': ['kashi-vishwanath', 'temple-etiquette', 'small-shrines', 'morning-kachori', 'chaat-and-lanes', 'old-city-walk', 'market-wander', 'godowlia-area'],
  'assi-side-area': ['riverfront-at-dusk', 'reading-the-ghats', 'chai-pause', 'river-stories', 'food-culture-walk'],
  'godowlia-area': ['old-city-area', 'market-wander', 'chaat-and-lanes', 'morning-kachori', 'old-city-walk', 'kashi-vishwanath'],
  'lanka-bhu-area': ['assi-side-area', 'chai-pause', 'riverfront-at-dusk', 'reading-the-ghats'],
};

export const tripAreas = items.filter((entry) => entry.category === 'areas');

export function detailHref(entry: DiscoveryItem) {
  const root = entry.category === 'food' ? 'food' : entry.category === 'stays' ? 'stays' : entry.category === 'guides' ? 'guides' : 'places';
  return `/${root}/${entry.slug}/`;
}

export function areaTitle(areaSlug: string) {
  return tripAreas.find((entry) => entry.slug === areaSlug)?.title ?? '';
}

export function itemsNearArea(areaSlug: string) {
  const slugs = areaNeighbours[areaSlug] ?? [];
  return slugs.map((slug) => items.find((entry) => entry.slug === slug)).filter((entry): entry is DiscoveryItem => Boolean(entry));
}

function matchesInterest(entry: DiscoveryItem, interest: Interest) {
  const words = `${entry.title} ${entry.subtitle} ${entry.overview} ${entry.tags.join(' ')}`.toLowerCase();
  if (interest === 'temples') return entry.category === 'temples' || words.includes('temple') || words.includes('puja');
  if (interest === 'ghats') return entry.category === 'ghats' || words.includes('riverfront') || words.includes('ghat');
  if (interest === 'food') return entry.category === 'food' || (entry.category === 'guides' && words.includes('food'));
  if (interest === 'history') return words.includes('history') || words.includes('stories') || words.includes('architecture');
  if (interest === 'shopping') return entry.category === 'shopping' || words.includes('market');
  if (interest === 'crafts') return entry.category === 'shopping' && (words.includes('craft') || words.includes('weaving') || words.includes('textile'));
  return entry.category === 'guides' || entry.category === 'local-businesses' || entry.category === 'events';
}

const interestReasons: Record<Interest, string> = {
  temples: 'A temple-focused idea drawn from the sample guide; check current visitor guidance and approach active worship respectfully.',
  ghats: 'A riverfront perspective from the sample guide. Shared spaces and local conditions can change.',
  food: 'A food-culture idea rather than a named venue; choose a place that suits your needs and confirm locally.',
  history: 'A way to notice the city’s stories and layers, without turning a living neighbourhood into a checklist.',
  shopping: 'A market or keepsake theme to explore with curiosity; no seller or product is verified.',
  crafts: 'A craft tradition to learn about; this is not a maker listing or provenance claim.',
  'local-experiences': 'A locally rooted theme from the illustrative guide, not a confirmed tour, provider or scheduled event.',
};

export function getTripDayCount(length: TripLength) {
  return length === 'half' ? 1 : Number(length);
}

export function makeItinerary(prefs: TripPreferences): ItineraryDay[] {
  const dayCount = getTripDayCount(prefs.length);
  const selected = prefs.interests.length ? prefs.interests : ['ghats', 'food', 'local-experiences'] as Interest[];
  const candidates = items.filter((entry) => entry.category !== 'stays' && entry.category !== 'travel' && entry.category !== 'areas')
    .map((entry) => {
      const matching = selected.filter((interest) => matchesInterest(entry, interest));
      const areaBoost = prefs.area && (entry.area?.toLowerCase().includes(areaTitle(prefs.area).toLowerCase()) || (areaNeighbours[prefs.area] ?? []).includes(entry.slug)) ? 1 : 0;
      return { entry, matching, areaBoost };
    })
    .filter((candidate) => candidate.matching.length > 0)
    .sort((a, b) => b.areaBoost - a.areaBoost || a.entry.slug.localeCompare(b.entry.slug));

  const slotNames = prefs.length === 'half' ? ['Morning', 'Afternoon'] : ['Morning', 'Afternoon', 'Evening'];
  const perDay = prefs.pace === 'packed' ? slotNames.length : Math.min(slotNames.length, 2);
  let cursor = 0;
  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const stops: ItineraryStop[] = [];
    const offset = prefs.length === 'half' ? 0 : 0;
    const selectedForDay: typeof candidates = [];
    for (let position = 0; position < perDay && candidates.length; position += 1) {
      selectedForDay.push(candidates[(cursor + offset + position) % candidates.length]);
    }
    cursor = (cursor + perDay) % Math.max(candidates.length, 1);
    slotNames.forEach((time, index) => {
      const candidate = selectedForDay[index];
      if (candidate) {
        const matchedInterest = candidate.matching[0];
        const reason = candidate.areaBoost
          ? `${interestReasons[matchedInterest]} Its broad area context is relevant to your chosen starting area.`
          : interestReasons[matchedInterest];
        stops.push({ kind: 'discovery', time, item: candidate.entry, reason });
      } else if (index === 0) {
        stops.push({ kind: 'break', time, title: 'Begin gently', reason: 'Leave room to settle in and find your bearings before the day gathers pace.' });
      } else if (index === 1) {
        stops.push({ kind: 'break', time, title: 'A meal and a pause', reason: 'Keep space for a meal and a little rest. No venue or price is assumed.' });
      } else {
        stops.push({ kind: 'break', time, title: 'Time to wander or rest', reason: 'Keep this open for an unhurried pause or a return to something that caught your attention.' });
      }
      if (index === 0 && slotNames.length > 2) {
        stops.push({ kind: 'break', time: 'Midday', title: 'Meal break', reason: 'Make room for lunch and rest. Choose a place locally; no venue, price or availability is assumed.' });
      }
      if (index === 1 && slotNames.length > 2) {
        stops.push({ kind: 'break', time: 'Late afternoon', title: 'A breather', reason: 'A little unplanned time helps keep the day comfortable. Adjust around weather and how you feel.' });
      }
    });
    const themes = selected.slice((dayIndex * 2) % selected.length, (dayIndex * 2) % selected.length + 2);
    return { number: dayIndex + 1, theme: themes.map((interest) => interestOptions.find((option) => option.value === interest)?.label).filter(Boolean).join(' · ') || 'A gentle first look', stops };
  });
}

export function formatItinerary(prefs: TripPreferences, days: ItineraryDay[]) {
  const length = lengthOptions.find((option) => option.value === prefs.length)?.label ?? 'Visit';
  const area = prefs.area ? `Starting area: ${areaTitle(prefs.area)}\n` : '';
  const interests = prefs.interests.length ? prefs.interests.map((interest) => interestOptions.find((option) => option.value === interest)?.label).join(', ') : 'A balanced mix';
  return [
    `My Kashi plan · ${length}`,
    `Budget lens: ${budgetLabels[prefs.budget]} (no prices or trip total estimated)`,
    `Interests: ${interests}`,
    area.trim(),
    ...days.flatMap((day) => [`\nDay ${day.number} · ${day.theme}`, ...day.stops.map((stop) => stop.kind === 'discovery'
      ? `${stop.time}: ${stop.item.title} — ${stop.reason} ${typeof window !== 'undefined' ? `${window.location.origin}${detailHref(stop.item)}` : detailHref(stop.item)}`
      : `${stop.time}: ${stop.title} — ${stop.reason}`)]),
    '\nIllustrative sample ideas only. Confirm current details locally; this plan does not estimate routes, timings, costs or visit durations.',
  ].filter(Boolean).join('\n');
}
