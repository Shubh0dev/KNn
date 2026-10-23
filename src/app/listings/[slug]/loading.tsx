import { Footer, Header } from '../../../App';
import { RouteLoading } from '@/components/loading/RouteLoading';

export default function Loading() {
  return <><Header /><main className="page-shell public-listing"><RouteLoading variant="page" label="Loading the listing…" /></main><Footer /></>;
}
