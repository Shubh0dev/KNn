-- Reference data: listing categories matching the public site's sections.
insert into public.listing_categories (slug, name, description, sort_order)
values
  ('temples', 'Temples & Darshan', 'Temples, darshan and sacred sites', 10),
  ('ghats', 'Ghats & Ganga', 'Ghats, aarti and river experiences', 20),
  ('stays', 'Stay in Kashi', 'Hotels, guest houses, homestays and dharamshalas', 30),
  ('food', 'Food & Dining', 'Street food, restaurants, thali and cafés', 40),
  ('travel', 'Travel & Transport', 'Taxis, rickshaws, boats and travel services', 50),
  ('shopping', 'Shopping & Markets', 'Banarasi sarees, handicrafts and markets', 60),
  ('spiritual-services', 'Spiritual Services', 'Puja, pandit and purohit services, jyotish', 70),
  ('guides', 'Guides & Experiences', 'Walks, guides and local experiences', 80),
  ('events', 'Events & Festivals', 'Festivals, cultural events and celebrations', 90),
  ('local-services', 'Local Services', 'Other local businesses and services', 100)
on conflict (slug) do nothing;
