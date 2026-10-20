export type Discovery = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  image?: string;
  label?: string;
};

export const shortcuts = [
  { label: 'Temples & Darshan', icon: 'temple', query: 'temple' },
  { label: 'Ghats & Ganga', icon: 'waves', query: 'ghat' },
  { label: 'Stay in Kashi', icon: 'bed', query: 'stay' },
  { label: 'Food & Dining', icon: 'utensils', query: 'food' },
  { label: 'Travel & Transport', icon: 'train', query: 'transport' },
  { label: 'Spiritual Services', icon: 'flower', query: 'puja' },
  { label: 'Guides & Experiences', icon: 'compass', query: 'guide' },
  { label: 'Shopping & Markets', icon: 'shopping', query: 'saree' },
  { label: 'Local Directory', icon: 'store', query: 'local' },
  { label: 'My Kashi Trip', icon: 'route', query: 'trip' },
  { label: 'Events & Festivals', icon: 'calendar', query: 'festival' },
  { label: 'More to explore', icon: 'more', query: 'kashi' },
];

export const stays: Discovery[] = [
  { id: 'budget-rooms', title: 'Budget rooms', subtitle: 'Simple stays, close to the old city', category: 'Stays', image: '/kashi-riverfront.jpg' },
  { id: 'standard-hotels', title: 'Standard hotels', subtitle: 'Comfort for an easy visit', category: 'Stays', image: '/kashi-lanes.jpg' },
  { id: 'premium-hotels', title: 'Premium hotels', subtitle: 'A little more room to unwind', category: 'Stays', image: '/kashi-riverfront.jpg' },
  { id: 'luxury-hotels', title: 'Luxury hotels', subtitle: 'A considered stay with extra comfort', category: 'Stays', image: '/kashi-lanes.jpg' },
  { id: 'dharamshalas', title: 'Dharamshalas', subtitle: 'Traditional pilgrim accommodation', category: 'Stays', image: '/kashi-lanes.jpg' },
  { id: 'guest-houses', title: 'Guest houses', subtitle: 'Small, locally run stays', category: 'Stays', image: '/kashi-riverfront.jpg' },
  { id: 'hostels', title: 'Hostels & PGs', subtitle: 'Shared spaces for longer visits', category: 'Stays', image: '/kashi-lanes.jpg' },
  { id: 'rentals', title: 'Long-stay rentals', subtitle: 'Make Kashi your own for a while', category: 'Stays', image: '/kashi-riverfront.jpg' },
  { id: 'homestays', title: 'Homestays', subtitle: 'A more personal way to experience Kashi', category: 'Stays', image: '/kashi-lanes.jpg' },
];

export const foods: Discovery[] = [
  { id: 'street-food', title: 'Street food', subtitle: 'Kachori, chaat & morning favourites', category: 'Food', image: '/kashi-food.jpg' },
  { id: 'restaurants', title: 'Restaurants', subtitle: 'Local kitchens and familiar comforts', category: 'Food', image: '/kashi-food.jpg' },
  { id: 'thali', title: 'Traditional thali', subtitle: 'A generous taste of the region', category: 'Food', image: '/kashi-food.jpg' },
  { id: 'sweets', title: 'Sweets & snacks', subtitle: 'From jalebi to malaiyyo', category: 'Food', image: '/kashi-food.jpg' },
  { id: 'cafes', title: 'Cafés by the ghats', subtitle: 'A slower cup with a river view', category: 'Food', image: '/kashi-riverfront.jpg' },
];

export const spiritual: Discovery[] = [
  { id: 'puja', title: 'Puja & path', subtitle: 'Understand the rituals and what to expect', category: 'Spiritual', image: '/kashi-riverfront.jpg' },
  { id: 'jyotish', title: 'Jyotish & kundli', subtitle: 'Traditional astrology services', category: 'Spiritual', image: '/kashi-lanes.jpg' },
  { id: 'pandit', title: 'Pandit & purohit', subtitle: 'Find guidance for a meaningful visit', category: 'Spiritual', image: '/kashi-riverfront.jpg' },
  { id: 'aarti', title: 'Aarti & sankalp', subtitle: 'Learn about ceremony and timings', category: 'Spiritual', image: '/kashi-riverfront.jpg' },
];

export const areas: Discovery[] = [
  { id: 'vishwanath-gali', title: 'Vishwanath Gali', subtitle: 'Temples, lanes & local flavours', category: 'Areas', image: '/kashi-lanes.jpg' },
  { id: 'godowlia', title: 'Godowlia', subtitle: 'Markets, movement & city life', category: 'Areas', image: '/kashi-lanes.jpg' },
  { id: 'assi-ghat', title: 'Assi Ghat', subtitle: 'Cafés, sunrise & a slower pace', category: 'Areas', image: '/kashi-riverfront.jpg' },
  { id: 'lanka-bhu', title: 'Lanka & BHU', subtitle: 'Campus culture and southern Kashi', category: 'Areas', image: '/kashi-lanes.jpg' },
  { id: 'cantt-station', title: 'Cantt & station', subtitle: 'Rail connections and city arrivals', category: 'Areas', image: '/kashi-riverfront.jpg' },
  { id: 'ravindrapuri', title: 'Ravindrapuri', subtitle: 'Neighbourhood cafés and quiet corners', category: 'Areas', image: '/kashi-lanes.jpg' },
];

export const itineraries: Discovery[] = [
  { id: 'one-day', title: 'A day in Kashi', subtitle: 'A gentle first look at the city', category: 'Itineraries', image: '/kashi-riverfront.jpg', label: '1 day' },
  { id: 'two-day', title: 'Ghats & old lanes', subtitle: 'Make room for unhurried discoveries', category: 'Itineraries', image: '/kashi-lanes.jpg', label: '2 days' },
  { id: 'three-day', title: 'Kashi, more deeply', subtitle: 'Temples, river, food and neighbourhoods', category: 'Itineraries', image: '/kashi-riverfront.jpg', label: '3 days' },
  { id: 'budget-trip', title: 'A thoughtful budget', subtitle: 'Plan around what matters most to you', category: 'Itineraries', image: '/kashi-lanes.jpg', label: 'Flexible' },
];

export const experiences: Discovery[] = [
  { id: 'temple-guide', title: 'Temple walk', subtitle: 'Find context in the stories and spaces', category: 'Experiences', image: '/kashi-lanes.jpg' },
  { id: 'ghat-guide', title: 'Ghat-side stories', subtitle: 'See the riverfront through local eyes', category: 'Experiences', image: '/kashi-riverfront.jpg' },
  { id: 'food-walk', title: 'Old-city food walk', subtitle: 'Follow the aromas through the lanes', category: 'Experiences', image: '/kashi-food.jpg' },
  { id: 'boat-ride', title: 'A boat on the Ganga', subtitle: 'A different perspective on the ghats', category: 'Experiences', image: '/kashi-riverfront.jpg' },
];

export const shopping: Discovery[] = [
  { id: 'banarasi-sarees', title: 'Banarasi sarees', subtitle: 'Silk, brocade and a living craft', category: 'Shopping', image: '/kashi-craft.jpg' },
  { id: 'handicrafts', title: 'Handicrafts', subtitle: 'Objects shaped by local hands', category: 'Shopping', image: '/kashi-craft.jpg' },
  { id: 'puja-items', title: 'Puja essentials', subtitle: 'Offerings and devotional keepsakes', category: 'Shopping', image: '/kashi-lanes.jpg' },
  { id: 'souvenirs', title: 'Thoughtful souvenirs', subtitle: 'Take home a little piece of Kashi', category: 'Shopping', image: '/kashi-craft.jpg' },
];

export const transport: Discovery[] = [
  { id: 'airport', title: 'Airport arrivals', subtitle: 'Orientation for the journey into town', category: 'Travel', image: '/kashi-riverfront.jpg' },
  { id: 'rail', title: 'Railway connections', subtitle: 'Get familiar with the city stations', category: 'Travel', image: '/kashi-lanes.jpg' },
  { id: 'local-transport', title: 'Getting around', subtitle: 'Local transport and walking guidance', category: 'Travel', image: '/kashi-lanes.jpg' },
  { id: 'boat-travel', title: 'River journeys', subtitle: 'Learn about boats and the riverfront', category: 'Travel', image: '/kashi-riverfront.jpg' },
];

export const events: Discovery[] = [
  { id: 'dev-deepawali', title: 'Dev Deepawali', subtitle: 'A riverfront evening of light and devotion', category: 'Events', image: '/kashi-riverfront.jpg' },
  { id: 'mahashivratri', title: 'Mahashivratri', subtitle: 'A night of prayer across the city', category: 'Events', image: '/kashi-lanes.jpg' },
  { id: 'ganga-aarti', title: 'Ganga Aarti', subtitle: 'A daily ritual on the river steps', category: 'Events', image: '/kashi-riverfront.jpg' },
  { id: 'upcoming-events', title: 'Upcoming events', subtitle: 'Discover what may be happening in Kashi', category: 'Events', image: '/kashi-riverfront.jpg' },
];

export const allDiscoveries = [...stays, ...foods, ...spiritual, ...areas, ...itineraries, ...experiences, ...shopping, ...transport, ...events];

export const sampleNote = 'Illustrative discovery ideas only. Details, opening hours, routes, prices and availability can change; confirm directly with local providers before making plans.';
