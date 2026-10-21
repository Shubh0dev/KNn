import { NextResponse, type NextRequest } from 'next/server';
import { searchListings } from '@/lib/public/listings';

/**
 * Public directory search for the Explore page. Read-only, anonymous (RLS
 * returns published listings of verified businesses only) and cacheable.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 100);
  const results = await searchListings(q);
  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
