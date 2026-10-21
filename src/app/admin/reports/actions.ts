'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin/context';
import { friendlyDbError, isUuid } from '@/lib/business/state';

const OUTCOMES: Record<string, { status: string; resolution?: string }> = {
  reviewing: { status: 'reviewing' },
  'resolved:no_action': { status: 'resolved', resolution: 'no_action' },
  'resolved:listing_updated': { status: 'resolved', resolution: 'listing_updated' },
  'resolved:listing_suspended': { status: 'resolved', resolution: 'listing_suspended' },
  'resolved:owner_contacted': { status: 'resolved', resolution: 'owner_contacted' },
  dismissed: { status: 'dismissed' },
};

export async function updateReport(formData: FormData) {
  const { supabase } = await requirePermission('reports.review');
  const id = formData.get('reportId');
  const outcome = OUTCOMES[String(formData.get('outcome') ?? '')];
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  const back = String(formData.get('back') ?? '');
  const target = back.startsWith('/admin/reports/') && !back.includes('//') ? back.split('#')[0] : '/admin/reports/';
  const join = (key: string, value: string) => `${target.split('?')[0]}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(target.split('?')[1] ?? '')), [key]: value })}`;

  if (!isUuid(id) || !outcome) redirect(join('error', 'That update is not valid.'));
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: id, p_status: outcome.status, p_resolution: outcome.resolution, p_note: note || undefined,
  });
  revalidatePath('/admin', 'layout');
  if (error) redirect(join('error', friendlyDbError(error, 'The report could not be updated.')));
  redirect(join('notice', 'report-updated'));
}
