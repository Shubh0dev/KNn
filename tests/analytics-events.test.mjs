import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanUtmSource, externalHost, isCategorySlug, isSiteEvent, normalizePath, sanitizeSearchTerm } from '../src/lib/analytics/events.ts';

test('only known event names are accepted', () => {
  assert.ok(isSiteEvent('page_view'));
  assert.ok(isSiteEvent('trip_saved'));
  assert.ok(!isSiteEvent('purchase'));
  assert.ok(!isSiteEvent('revenue'));
  assert.ok(!isSiteEvent(''));
});

test('paths: query strings removed, private areas never tracked', () => {
  assert.equal(normalizePath('/stays/?q=cheap&token=abc'), '/stays/');
  assert.equal(normalizePath('/Listings/Ganga-View/#photos'), '/listings/ganga-view/');
  for (const p of ['/admin/', '/superadmin/users/', '/business/listings/', '/account/', '/auth/callback/', '/api/listings/search/']) {
    assert.equal(normalizePath(p), null, p);
  }
  assert.equal(normalizePath('https://evil.example/'), null);
  assert.equal(normalizePath('/<script>'), null);
  assert.equal(normalizePath(''), null);
});

test('search terms lose e-mails and phone numbers', () => {
  assert.equal(sanitizeSearchTerm('  Ghat   STAYS '), 'ghat stays');
  assert.equal(sanitizeSearchTerm('room near assi call +91 98765 43210'), 'room near assi call');
  assert.equal(sanitizeSearchTerm('contact me at priya@example.com please'), 'contact me at please');
  assert.equal(sanitizeSearchTerm('9876543210'), null);
  assert.equal(sanitizeSearchTerm('a'), null);
  assert.ok((sanitizeSearchTerm('x'.repeat(200)) ?? '').length <= 60);
});

test('outbound host extraction', () => {
  assert.equal(externalHost('https://www.partner.example/path?x=1', 'www.kashinagri.com'), 'partner.example');
  assert.equal(externalHost('https://kashinagri.com/stays/', 'www.kashinagri.com'), null);
  assert.equal(externalHost('javascript:alert(1)', 'www.kashinagri.com'), null);
  assert.equal(externalHost('mailto:a@b.c', 'www.kashinagri.com'), null);
  assert.equal(externalHost('not a url', 'www.kashinagri.com'), null);
});

test('utm source and category validation', () => {
  assert.equal(cleanUtmSource('Instagram'), 'instagram');
  assert.equal(cleanUtmSource('<script>'), null);
  assert.equal(cleanUtmSource(''), null);
  assert.ok(isCategorySlug('spiritual-services'));
  assert.ok(!isCategorySlug('Temples & Darshan'));
});
