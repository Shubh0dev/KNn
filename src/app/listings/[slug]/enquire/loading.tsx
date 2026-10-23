import { Footer, Header } from '../../../../App';
import { RouteLoading } from '@/components/loading/RouteLoading';

export default function Loading() {
  return <><Header /><main className="page-shell public-report"><RouteLoading variant="form" label="Opening the request form…" /></main><Footer /></>;
}
