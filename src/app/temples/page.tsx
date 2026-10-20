import type { Metadata } from 'next';
import { CategoryPage } from '../../DiscoveryPages';
import { categoryMetadata } from '../../discovery-data';

export const metadata: Metadata = categoryMetadata('temples');
export default function Page() { return <CategoryPage slug="temples" />; }
