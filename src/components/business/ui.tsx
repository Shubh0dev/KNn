import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Tone } from '@/lib/business/constants';

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`bp-badge bp-tone-${tone}`}>{label}</span>;
}

export function StatCard({ label, value, hint, href, tone = 'neutral' }: {
  label: string; value: string | number; hint?: string; href?: string; tone?: Tone;
}) {
  const body = <>
    <span className="bp-stat-label">{label}</span>
    <strong className={`bp-stat-value bp-stat-${tone}`}>{value}</strong>
    {hint && <small>{hint}</small>}
  </>;
  return href
    ? <Link href={href} className="bp-stat bp-stat-link">{body}</Link>
    : <div className="bp-stat">{body}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="bp-empty">
    <h2 className="serif">{title}</h2>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

export type Crumb = { label: string; href?: string };

export function PageHeader({ title, crumbs, actions, lede }: { title: string; crumbs?: Crumb[]; actions?: ReactNode; lede?: string }) {
  return <div className="bp-page-header">
    <div>
      {crumbs && crumbs.length > 0 && <nav aria-label="Breadcrumb" className="bp-crumbs">
        <ol>{crumbs.map((crumb, index) => <li key={crumb.label}>
          {crumb.href && index < crumbs.length - 1 ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
        </li>)}</ol>
      </nav>}
      <h1 className="serif">{title}</h1>
      {lede && <p className="bp-lede">{lede}</p>}
    </div>
    {actions && <div className="bp-header-actions">{actions}</div>}
  </div>;
}

/** Success/error banner driven by ?notice= and ?error= on the page URL. */
export function FlashNotice({ params }: { params: Record<string, string | string[] | undefined> }) {
  const notice = typeof params.notice === 'string' ? params.notice : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;
  if (!notice && !error) return null;
  return error
    ? <p className="auth-notice auth-error bp-flash" role="alert">{error.slice(0, 300)}</p>
    : <p className="auth-notice auth-success bp-flash" role="status">{(NOTICES[notice!] ?? 'Done.')}</p>;
}

const NOTICES: Record<string, string> = {
  created: 'Listing created as a draft.',
  saved: 'Changes saved.',
  submitted: 'Submitted for review. We will let you know the outcome here.',
  archived: 'Listing archived.',
  restored: 'Listing restored as a draft. Submit it again when ready.',
  deleted: 'Draft deleted.',
  'business-created': 'Business created. Next, upload a document and request verification.',
  'verification-requested': 'Verification requested. Our team will review your documents.',
  'document-added': 'Document uploaded.',
  'document-removed': 'Document removed.',
  'status-updated': 'Enquiry updated.',
};
