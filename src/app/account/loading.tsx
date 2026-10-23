import Link from 'next/link';
import { RouteLoading } from '@/components/loading/RouteLoading';

/** Account pages render their own PanelShell, so the loading screen draws the same header frame. */
export default function Loading() {
  return <div className="panel-page">
    <header className="panel-header">
      <div className="page-shell panel-header-inner">
        <Link href="/" className="brand-lockup" aria-label="KashiNagri home">
          <span className="brand-mark" aria-hidden="true"><span>क</span></span>
          <span className="brand-copy"><strong>KashiNagri</strong><small>Your account</small></span>
        </Link>
      </div>
    </header>
    <main className="page-shell panel-main"><RouteLoading variant="list" label="Loading your account…" /></main>
  </div>;
}
