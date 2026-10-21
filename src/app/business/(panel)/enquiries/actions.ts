'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBusinessContext } from '@/lib/business/context';
import { ENQUIRY_STATUS } from '@/lib/business/constants';
import { isUuid } from '@/lib/business/state';

/** Only same-section return paths are accepted. */
function backPath(value: unknown) {
  const path = typeof value === 'string' ? value : '';
  return path.startsWith('/business/enquiries/') && !path.includes('//') && !path.includes('\\') ? path.split('#')[0].split('?')[0] : '/business/enquiries/';
}
const joinQuery = (path: string, search: string, key: string, value: string) => {
  const params = new URLSearchParams(search);
  params.delete('notice');
  params.delete('error');
  params.set(key, value);
  return `${path}?${params}`;
};

export async function setEnquiryStatus(formData: FormData) {
  const { supabase, active } = await getBusinessContext();
  const back = backPath(formData.get('back'));
  const search = String(formData.get('search') ?? '').slice(0, 300);
  const id = formData.get('enquiryId');
  const status = String(formData.get('status') ?? '');

  if (!isUuid(id) || !(status in ENQUIRY_STATUS) || status === 'new') {
    redirect(joinQuery(back, search, 'error', 'That update is not valid.'));
  }

  // The business_id filter plus RLS mean another business's enquiry can never match.
  const { data, error } = await supabase
    .from('enquiries')
    .update({ status })
    .eq('id', id)
    .eq('business_id', active.id)
    .select('id');

  if (error || !data?.length) redirect(joinQuery(back, search, 'error', 'The enquiry could not be updated. It may no longer exist.'));
  revalidatePath('/business', 'layout');
  redirect(joinQuery(back, search, 'notice', 'status-updated'));
}
