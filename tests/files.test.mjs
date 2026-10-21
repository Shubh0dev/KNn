import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffMime } from '../src/lib/files.ts';

const bytes = (...parts) => Uint8Array.from(parts.flatMap(p => typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p).concat(Array(16).fill(0)));

test('real file signatures are recognised', () => {
  assert.equal(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffMime(bytes([0x89], 'PNG\r\n')), 'image/png');
  assert.equal(sniffMime(bytes('RIFF', [0, 0, 0, 0], 'WEBP')), 'image/webp');
  assert.equal(sniffMime(bytes([0, 0, 0, 0x1c], 'ftypavif')), 'image/avif');
  assert.equal(sniffMime(bytes('%PDF-1.7')), 'application/pdf');
});

test('disguised or dangerous files are rejected', () => {
  assert.equal(sniffMime(bytes('<svg xmlns="http')), null);          // SVG can carry scripts
  assert.equal(sniffMime(bytes('<!DOCTYPE html>')), null);
  assert.equal(sniffMime(bytes('MZ'), [0x90, 0x00]), null);           // Windows executable
  assert.equal(sniffMime(bytes('PK', [3, 4])), null);                 // zip / office file
  assert.equal(sniffMime(bytes('just some text')), null);
  assert.equal(sniffMime(new Uint8Array([0xff, 0xd8])), null);        // truncated
});
