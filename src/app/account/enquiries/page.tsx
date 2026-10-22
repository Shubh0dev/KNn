import type { Metadata } from 'next';
import Link from 'next/link';
import { PanelShell } from '@/components/PanelShell';
import { EmptyState, FlashNotice } from '@/components/business/ui';
import { EnquiryStatus } from '@/components/enquiries/EnquiryParts';
import { requireSignedIn } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/business/format';
import { requestSummary } from '@/lib/enquiries/rules';

export const metadata: Metadata = { title: 'Your requests | KashiNagri', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireSignedIn('/account/enquiries/');
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: unread }] = await Promise.all([
    supabase.from('enquiries')
      .select('id, reference, status, enquiry_type, created_at, updated_at, check_in, check_out, requested_date, requested_time, guests, rooms, experience, listings ( title, slug, businesses ( name ) )')
      .eq('sender_id', access.user.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('notifications').select('enquiry_id').eq('user_id', access.user.id).is('read_at', null),
  ]);
  const updated = new Set((unread ?? []).map(n => n.enquiry_id));
  const rows = (data ?? []) as any[];

  return <PanelShell access={access} panel="Your account">
    <span className="eyebrow"><Link href="/account/">Your account</Link></span>
    <h1 className="serif panel-title">Your requests</h1>
    <p className="bp-muted">Bookings and questions you sent to businesses. A request is only booked once the business confirms it.</p>
    <FlashNotice params={params} />
    {error
      ? <p className="auth-notice auth-error" role="alert">We could not load your requests. Please refresh to try again.</p>
      : rows.length === 0
        ? <EmptyState title="No requests yet" action={<Link href="/directory/" className="button-primary">Find a stay, table or guide</Link>}>
            When you send a request to a business, you can follow its status here.
          </EmptyState>
        : <ul className="enquiry-list" data-testid="visitor-enquiries">{rows.map(row => {
            const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
            const business = listing ? (Array.isArray(listing.businesses) ? listing.businesses[0] : listing.businesses) : null;
            return <li key={row.id} className={`enquiry-list-item ${updated.has(row.id) ? 'is-updated' : ''}`}>
              <Link href={`/account/enquiries/${row.id}/`} data-testid={`visitor-enquiry-${row.reference}`}>
                <span className="enquiry-list-main">
                  <strong>{listing?.title ?? 'Listing no longer public'}</strong>
                  <small>{business?.name ? `${business.name} · ` : ''}{requestSummary(row)}</small>
                  <small>{row.reference} · sent {formatDateTime(row.created_at)}</small>
                </span>
                <span className="enquiry-list-side">
                  {updated.has(row.id) && <b className="bp-count">Update</b>}
                  <EnquiryStatus status={row.status} />
                </span>
              </Link>
            </li>;
          })}</ul>}
  </PanelShell>;
}
