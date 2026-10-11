import type { Metadata } from 'next';
import { CategoryPage } from '../../DiscoveryPages';
import { categoryMetadata } from '../../discovery-data';

export const metadata: Metadata = categoryMetadata('areas');
export default function Page() { return <CategoryPage slug="areas" />; }
