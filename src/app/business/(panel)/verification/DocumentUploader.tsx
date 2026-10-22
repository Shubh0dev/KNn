'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DOCUMENT_LIMITS, DOCUMENT_TYPES } from '@/lib/business/constants';
import { addVerificationDocument } from './actions';
import { LoadingButton } from '@/components/loading/LoadingButton';

const EXTENSIONS: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

async function sniffDocumentType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  return null;
}

export function DocumentUploader({ businessId }: { businessId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return; // a second click while uploading does nothing
    const file = fileInput.current?.files?.[0];
    if (!file) return setState({ ok: false, text: 'Choose a file to upload.' });
    inFlight.current = true;
    setBusy(true);
    setState(null);
    // try/finally: errors and dropped connections always clear the busy state.
    try {
      if (!DOCUMENT_LIMITS.types.includes(file.type) || (await sniffDocumentType(file)) === null) {
        return setState({ ok: false, text: 'Only PDF, JPEG or PNG files are accepted.' });
      }
      if (file.size > DOCUMENT_LIMITS.maxBytes) return setState({ ok: false, text: 'Files must be 10 MB or smaller.' });
      const supabase = createClient();
      // Private bucket: the first folder must be the business id (enforced by Storage policy).
      const path = `${businessId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error } = await supabase.storage.from('verification-documents').upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setState({ ok: false, text: 'The upload failed. Check your connection and try again.' });
      const result = await addVerificationDocument({ documentType: type, path });
      if (!result.ok) await supabase.storage.from('verification-documents').remove([path]);
      setState(result.ok ? { ok: true, text: 'Document uploaded.' } : { ok: false, text: result.error });
      if (result.ok && fileInput.current) fileInput.current.value = '';
      router.refresh();
    } catch {
      setState({ ok: false, text: 'The upload stopped because of a connection or server problem. Please try again.' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="bp-form bp-upload-form" noValidate>
    <div className="bp-field">
      <label htmlFor="doc-type">Document type</label>
      <select id="doc-type" value={type} onChange={e => setType(e.target.value)} data-testid="select-document-type">
        {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
    </div>
    <div className="bp-field">
      <label htmlFor="doc-file">File</label>
      <input id="doc-file" ref={fileInput} type="file" accept={DOCUMENT_LIMITS.types.join(',')} data-testid="input-document-file" />
      <small>PDF, JPEG or PNG, up to 10 MB. Only you and the KashiNagri verification team can open it.</small>
    </div>
    {state && <p className={`auth-notice ${state.ok ? 'auth-success' : 'auth-error'}`} role={state.ok ? 'status' : 'alert'}>{state.text}</p>}
    <LoadingButton loading={busy} loadingLabel="Uploading…" className="bp-btn-secondary" testId="button-upload-document"><Upload size={15} /> Upload document</LoadingButton>
  </form>;
}
