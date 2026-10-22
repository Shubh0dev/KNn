import { StatusBadge } from '@/components/business/ui';
import { formatDateTime } from '@/lib/business/format';
import { ENQUIRY_STATUS, KIND_COPY, daysBetween, type EnquiryKind } from '@/lib/enquiries/rules';

export type EnquiryRow = {
  id: string; reference: string; status: string; enquiry_type: string; created_at: string; updated_at?: string;
  check_in: string | null; check_out: string | null; requested_date: string | null; requested_time: string | null;
  guests: number | null; rooms: number | null; experience: string | null; message: string; business_response?: string | null;
};
export type EnquiryEvent = { actor: string; from_status: string | null; to_status: string; message: string | null; created_at: string };

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function EnquiryStatus({ status }: { status: string }) {
  const s = ENQUIRY_STATUS[status];
  return <StatusBadge label={s?.label ?? status} tone={s?.tone ?? 'neutral'} />;
}

/** What was requested: dates, times and group size. Contains no contact details. */
export function RequestDetails({ e }: { e: EnquiryRow }) {
  const kind = (e.enquiry_type in KIND_COPY ? e.enquiry_type : 'general') as EnquiryKind;
  const rows: [string, string][] = [['Type', KIND_COPY[kind].label]];
  if (kind === 'stay' && e.check_in && e.check_out) {
    const nights = daysBetween(e.check_in, e.check_out);
    rows.push(['Check-in', day(e.check_in)], ['Check-out', day(e.check_out)], ['Nights', String(nights)]);
  }
  if ((kind === 'table' || kind === 'experience') && e.requested_date) rows.push([kind === 'table' ? 'Date' : 'Preferred date', day(e.requested_date)]);
  if (kind === 'table' && e.requested_time) rows.push(['Time', e.requested_time.slice(0, 5)]);
  if (kind === 'experience' && e.experience) rows.push(['Experience', e.experience]);
  if (e.guests) rows.push([kind === 'table' ? 'Party size' : kind === 'experience' ? 'Participants' : 'Guests', String(e.guests)]);
  if (e.rooms) rows.push(['Rooms', String(e.rooms)]);
  rows.push(['Sent', formatDateTime(e.created_at)]);
  return <dl className="enquiry-details" data-testid="enquiry-details">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

type Viewer = 'visitor' | 'business' | 'staff';
const ACTOR: Record<string, Record<Viewer, string>> = {
  visitor: { visitor: 'You', business: 'Traveller', staff: 'Traveller' },
  business: { visitor: 'Business', business: 'You', staff: 'Business' },
  staff: { visitor: 'KashiNagri', business: 'KashiNagri', staff: 'KashiNagri' },
};

export function Timeline({ events, viewer }: { events: EnquiryEvent[]; viewer: Viewer }) {
  if (!events.length) return null;
  return <ol className="enquiry-timeline" data-testid="enquiry-timeline">{events.map((ev, i) => {
    const who = ACTOR[ev.actor]?.[viewer] ?? ev.actor;
    const what = ev.from_status === null ? 'sent the request'
      : ev.from_status === ev.to_status ? 'sent a message'
        : `changed the status to ${ENQUIRY_STATUS[ev.to_status]?.label ?? ev.to_status}`;
    return <li key={i}>
      <span className="enquiry-timeline-head"><strong>{who}</strong> {what}<time dateTime={ev.created_at}>{formatDateTime(ev.created_at)}</time></span>
      {ev.message && <p className="enquiry-timeline-message">{ev.message}</p>}
    </li>;
  })}</ol>;
}
