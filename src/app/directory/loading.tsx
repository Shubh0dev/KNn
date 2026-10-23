import { Footer, Header } from '../../App';
import { RouteLoading } from '@/components/loading/RouteLoading';

export default function Loading() {
  return <><Header /><main className="page-shell directory-page"><RouteLoading variant="page" label="Loading verified businesses…" /></main><Footer /></>;
}
