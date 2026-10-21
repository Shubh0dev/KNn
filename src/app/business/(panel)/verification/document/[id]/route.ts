import { NextResponse } from 'next/server';
import { getBusinessContext } from '@/lib/business/context';
import { isUuid } from '@/lib/business/state';

/**
 * Opens a private verification document through a short-lived signed URL.
 * The file is never public: the row is read under Row Level Security first,
 * so only members of the owning business (or verifiers, elsewhere) get a link.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, active } = await getBusinessContext();
  const { id } = await params;
  const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!isUuid(id)) return notFound();

  const { data: doc } = await supabase
    .from('business_verification_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('business_id', active.id)
    .maybeSingle();
  if (!doc) return notFound();

  const { data, error } = await supabase.storage.from('verification-documents').createSignedUrl(doc.storage_path, 60);
  if (error || !data) return notFound();

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
