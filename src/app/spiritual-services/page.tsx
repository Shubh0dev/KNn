import type { Metadata } from 'next';
import { CategoryPage } from '../../DiscoveryPages';
import { categoryMetadata } from '../../discovery-data';

export const metadata: Metadata = categoryMetadata('spiritual-services');
export default function Page() { return <CategoryPage slug="spiritual-services" />; }
