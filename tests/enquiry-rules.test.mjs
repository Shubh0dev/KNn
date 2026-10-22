import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enquiryKind, nextStatuses, validateEnquiry, whatsappNumber, whatsappHref, telHref, indiaNow, addDays, requestSummary } from '../src/lib/enquiries/rules.ts';

// Fixed clock: 22 Oct 2026, 10:00 in India (04:30 UTC).
const NOW = new Date('2026-10-22T04:30:00Z');
const base = { name: 'Priya Sharma', phone: '+91 98765 43210', email: 'Priya@Example.com', message: '' };

test('request type follows category and listing mode', () => {
  assert.equal(enquiryKind('stays', 'booking'), 'stay');
  assert.equal(enquiryKind('food', 'booking'), 'table');
  assert.equal(enquiryKind('guides', 'booking'), 'experience');
  assert.equal(enquiryKind('shopping', 'booking'), 'general');
  assert.equal(enquiryKind('stays', 'message'), 'general');
  assert.equal(enquiryKind('stays', 'contact_only'), 'none');
});

test('India time is used for "today"', () => {
  assert.deepEqual(indiaNow(NOW), { date: '2026-10-22', time: '10:00' });
  assert.deepEqual(indiaNow(new Date('2026-10-22T20:00:00Z')), { date: '2026-10-23', time: '01:30' });
});

test('valid stay request normalises values', () => {
  const r = validateEnquiry({ ...base, kind: 'stay', checkIn: '2026-11-02', checkOut: '2026-11-05', guests: '3', rooms: '2' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.values.sender_email, 'priya@example.com');
  assert.equal(r.values.guests, 3);
  assert.equal(r.values.requested_date, null);
});

test('stay request date and count rules', () => {
  const bad = (extra) => validateEnquiry({ ...base, kind: 'stay', checkIn: '2026-11-02', checkOut: '2026-11-05', guests: '2', rooms: '1', ...extra }, NOW);
  assert.ok(bad({ checkIn: '2026-10-21' }).fieldErrors.checkIn.includes('past'));
  assert.ok(bad({ checkOut: '2026-11-02' }).fieldErrors.checkOut.includes('after check-in'));
  assert.ok(bad({ checkOut: '2026-11-01' }).fieldErrors.checkOut.includes('after check-in'));
  assert.ok(bad({ checkOut: addDays('2026-11-02', 61) }).fieldErrors.checkOut.includes('60 nights'));
  assert.ok(bad({ checkIn: addDays('2026-10-22', 366), checkOut: addDays('2026-10-22', 367) }).fieldErrors.checkIn);
  assert.ok(bad({ guests: '0' }).fieldErrors.guests);
  assert.ok(bad({ guests: '2.5' }).fieldErrors.guests);
  assert.ok(bad({ guests: '51' }).fieldErrors.guests);
  assert.ok(bad({ rooms: '3' }).fieldErrors.rooms.includes('more than'));
  assert.equal(bad({ checkIn: '2026-10-22', checkOut: '2026-10-23' }).ok, true, 'same-day check-in is allowed');
});

test('table request needs a future date and time', () => {
  const t = (extra) => validateEnquiry({ ...base, kind: 'table', date: '2026-10-22', time: '20:00', guests: '4', ...extra }, NOW);
  assert.equal(t({}).ok, true);
  assert.ok(t({ time: '09:00' }).fieldErrors.time.includes('past'));
  assert.ok(t({ date: '2026-10-21' }).fieldErrors.date);
  assert.ok(t({ time: '25:00' }).fieldErrors.time);
  assert.ok(t({ guests: '' }).fieldErrors.guests);
});

test('experience request and general enquiry', () => {
  assert.equal(validateEnquiry({ ...base, kind: 'experience', date: '2026-12-01', guests: '2', experience: 'Morning boat ride' }, NOW).ok, true);
  assert.ok(validateEnquiry({ ...base, kind: 'experience', date: '', guests: '2' }, NOW).fieldErrors.date);
  assert.ok(validateEnquiry({ ...base, kind: 'general', message: 'short' }, NOW).fieldErrors.message);
  assert.equal(validateEnquiry({ ...base, kind: 'general', message: 'Do you have parking nearby?' }, NOW).ok, true);
});

test('contact details are validated', () => {
  const g = (extra) => validateEnquiry({ ...base, kind: 'general', message: 'Is the shop open on Sunday?', ...extra }, NOW);
  assert.ok(g({ phone: '' }).fieldErrors.phone);
  assert.ok(g({ phone: '12ab' }).fieldErrors.phone);
  assert.ok(g({ phone: '+1234567890123456789' }).fieldErrors.phone);
  assert.ok(g({ email: 'not-an-email' }).fieldErrors.email);
  assert.ok(g({ name: 'A' }).fieldErrors.name);
  assert.equal(g({ phone: '0542 240 1234' }).ok, true);
});

test('status transitions', () => {
  assert.deepEqual(nextStatuses('new', 'visitor'), ['cancelled']);
  assert.deepEqual(nextStatuses('confirmed', 'visitor'), []);
  assert.ok(nextStatuses('new', 'business').includes('accepted'));
  assert.ok(!nextStatuses('new', 'business').includes('confirmed'), 'cannot confirm before accepting');
  assert.deepEqual(nextStatuses('accepted', 'business'), ['confirmed', 'cancelled']);
  assert.deepEqual(nextStatuses('completed', 'business'), []);
  assert.deepEqual(nextStatuses('declined', 'business'), []);
});

test('WhatsApp numbers', () => {
  assert.equal(whatsappNumber('+91 98765 43210'), '919876543210');
  assert.equal(whatsappNumber('98765 43210'), '919876543210');
  assert.equal(whatsappNumber('09876543210'), '919876543210');
  assert.equal(whatsappNumber('0542 2401234'), null, 'landline');
  assert.equal(whatsappNumber('+91 542 2401234'), null, 'Indian landline with code');
  assert.equal(whatsappNumber('+44 7700 900123'), '447700900123');
  assert.equal(whatsappNumber(''), null);
  assert.equal(whatsappHref('9876543210', 'Hi'), 'https://wa.me/919876543210?text=Hi');
  assert.equal(telHref('+91 (98765) 43210'), 'tel:+919876543210');
});

test('request summary has no contact details', () => {
  const s = requestSummary({ enquiry_type: 'stay', check_in: '2026-11-02', check_out: '2026-11-05', guests: 2, rooms: 1 });
  assert.match(s, /3 nights · 2 guests · 1 room/);
});
