'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { IMAGE_LIMITS } from '@/lib/business/constants';
import { moveListingImage, registerListingImage, removeListingImage, setCoverImage } from './actions';

export type ManagedImage = { id: string; url: string; alt: string | null; is_cover: boolean };

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

/** Checks the file's first bytes, not just its declared type. */
async function sniffImageType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  return null;
}

type Result = { ok: boolean; error?: string };
export type ImageActions = {
  register: (input: { listingId: string; path: string; alt?: string }) => Promise<Result>;
  remove: (input: { listingId: string; imageId: string }) => Promise<Result>;
  setCover: (input: { listingId: string; imageId: string }) => Promise<Result>;
  move: (input: { listingId: string; imageId: string; direction: 'up' | 'down' }) => Promise<Result>;
};
const BUSINESS_ACTIONS: ImageActions = { register: registerListingImage, remove: removeListingImage, setCover: setCoverImage, move: moveListingImage };

export function ImageManager({ listingId, images, editable, published, actions = BUSINESS_ACTIONS, maxImages = IMAGE_LIMITS.max, reviewNotice = true }: {
  listingId: string; images: ManagedImage[]; editable: boolean; published: boolean;
  actions?: ImageActions; maxImages?: number; reviewNotice?: boolean;
}) {
  const { register: registerListingImage, remove: removeListingImage, setCover: setCoverImage, move: moveListingImage } = actions;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, startTransition] = useTransition();
  const [messages, setMessages] = useState<{ ok: boolean; text: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toRemove, setToRemove] = useState<ManagedImage | null>(null);

  const remaining = maxImages - images.length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessages([]);
    const supabase = createClient();
    const results: { ok: boolean; text: string }[] = [];

    for (const file of Array.from(files).slice(0, Math.max(remaining, 0))) {
      if (!IMAGE_LIMITS.types.includes(file.type) || (await sniffImageType(file)) === null) {
        results.push({ ok: false, text: `${file.name}: only JPEG, PNG, WebP or AVIF images are allowed.` });
        continue;
      }
      if (file.size > IMAGE_LIMITS.maxBytes) {
        results.push({ ok: false, text: `${file.name}: images must be 5 MB or smaller.` });
        continue;
      }
      const path = `${listingId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error } = await supabase.storage.from('listing-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        results.push({ ok: false, text: `${file.name}: the upload failed. Check your connection and try again.` });
        continue;
      }
      const registered = await registerListingImage({ listingId, path });
      results.push(registered.ok ? { ok: true, text: `${file.name} uploaded.` } : { ok: false, text: `${file.name}: ${registered.error}` });
      if (!registered.ok) await supabase.storage.from('listing-images').remove([path]);
    }
    if (files.length > Math.max(remaining, 0)) results.push({ ok: false, text: `Only ${maxImages} images are allowed per listing; extra files were skipped.` });

    setMessages(results);
    setUploading(false);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      setMessages(result.ok ? [] : [{ ok: false, text: result.error ?? 'That did not work.' }]);
      router.refresh();
    });

  return <div className="bp-images">
    {published && editable && reviewNotice && <p className="bp-muted">Adding photos to a published listing sends it back for review.</p>}

    {images.length === 0
      ? <p className="bp-muted">No images yet. Add at least one clear photo before submitting.</p>
      : <ul className="bp-image-grid">{images.map((image, index) => <li key={image.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.alt ?? ''} loading="lazy" />
          {image.is_cover && <span className="bp-cover-tag"><Star size={11} /> Cover</span>}
          {editable && <div className="bp-image-actions">
            <button type="button" onClick={() => run(() => moveListingImage({ listingId, imageId: image.id, direction: 'up' }))} disabled={busy || index === 0} aria-label="Move earlier"><ArrowLeft size={14} /></button>
            <button type="button" onClick={() => run(() => moveListingImage({ listingId, imageId: image.id, direction: 'down' }))} disabled={busy || index === images.length - 1} aria-label="Move later"><ArrowRight size={14} /></button>
            {!image.is_cover && <button type="button" onClick={() => run(() => setCoverImage({ listingId, imageId: image.id }))} disabled={busy} aria-label="Make cover image"><Star size={14} /></button>}
            <button type="button" onClick={() => { setToRemove(image); dialog.current?.showModal(); }} disabled={busy} aria-label="Remove image" className="is-danger"><Trash2 size={14} /></button>
          </div>}
        </li>)}</ul>}

    {editable && remaining > 0 && <>
      <input ref={input} type="file" accept={IMAGE_LIMITS.types.join(',')} multiple hidden onChange={e => upload(e.target.files)} data-testid="input-listing-images" />
      <button type="button" className="bp-btn-secondary" onClick={() => input.current?.click()} disabled={uploading || busy}>
        <ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Add images'}
      </button>
      <small className="bp-muted"> JPEG, PNG, WebP or AVIF, up to 5 MB each. {remaining} more allowed.</small>
    </>}

    {messages.length > 0 && <ul className="bp-upload-log" aria-live="polite">{messages.map((m, i) => <li key={i} className={m.ok ? 'is-ok' : 'is-bad'}>{m.text}</li>)}</ul>}

    <dialog ref={dialog} className="bp-dialog" aria-labelledby="img-remove-title">
      <h2 id="img-remove-title" className="serif">Remove this image?</h2>
      <p>The photo will be removed from the listing and deleted from storage. This cannot be undone.</p>
      <div className="bp-dialog-actions">
        <button type="button" className="bp-btn-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="bp-btn-danger" data-testid="button-confirm-remove-image" onClick={() => {
          dialog.current?.close();
          if (toRemove) run(() => removeListingImage({ listingId, imageId: toRemove.id }));
        }}>Remove image</button>
      </div>
    </dialog>
  </div>;
}
