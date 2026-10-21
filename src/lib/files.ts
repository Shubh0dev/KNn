/** File type from the first bytes ("magic numbers"), independent of the declared Content-Type. */
export function sniffMime(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
