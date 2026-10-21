import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin/context';
import { isUuid } from '@/lib/business/state';

/**
 * Opens a private verification document for a verifier through a 60-second
 * signed URL. The document row and the file are both read under RLS, which
 * only allows the business's members and holders of businesses.verify.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requirePermission('businesses.verify');
  const { id } = await params;
  const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!isUuid(id)) return notFound();

  const { data: doc } = await supabase.from('business_verification_documents').select('storage_path').eq('id', id).maybeSingle();
  if (!doc) return notFound();
  const { data, error } = await supabase.storage.from('verification-documents').createSignedUrl(doc.storage_path, 60);
  if (error || !data) return notFound();

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
