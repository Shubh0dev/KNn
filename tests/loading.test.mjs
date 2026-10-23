import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpinnerController } from '../src/lib/loading/controller.ts';
import { LOADING_CONFIG, loadingCssVars, spinnersEnabled } from '../src/lib/loading/config.ts';

/** Deterministic clock: timers fire only when advanced. */
function fakeClock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  return {
    timers: {
      set: (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id; },
      clear: key => { timers.delete(key); },
      now: () => now,
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

const make = (clock, log) => createSpinnerController({ delay: 150, minimum: 300, onChange: v => log.push([clock.timers.now(), v]), timers: clock.timers });

test('defaults match the documented values', () => {
  assert.equal(LOADING_CONFIG.spinnerDelay, 150);
  assert.equal(LOADING_CONFIG.minimumSpinnerDuration, 200);
  assert.ok(LOADING_CONFIG.minimumSpinnerDuration >= 150 && LOADING_CONFIG.minimumSpinnerDuration <= 200, 'minimum display within the 150–200 ms range');
  assert.equal(LOADING_CONFIG.navigationStyle, 'spinner');
  assert.equal(LOADING_CONFIG.routeFallback, 'skeleton');
  assert.deepEqual(Object.keys(LOADING_CONFIG.sizes).sort(), ['button', 'inline', 'navigation', 'page', 'section']);
  assert.equal(LOADING_CONFIG.navigationLoadingEnabled, true);
  assert.equal(LOADING_CONFIG.buttonLoadingEnabled, true);
  assert.equal(LOADING_CONFIG.globalLoadingEnabled, true);
  assert.ok(LOADING_CONFIG.navigationTimeout > 0);
});

test('an operation that finishes before the delay never shows a spinner', () => {
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); clock.advance(120); c.stop(); clock.advance(1000);
  assert.deepEqual(log, []);
  assert.equal(c.visible, false);
  assert.equal(clock.pending(), 0, 'no timers left behind');
});

test('a slow operation shows the spinner after the delay and hides when done', () => {
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); clock.advance(149);
  assert.deepEqual(log, []);
  clock.advance(1);
  assert.deepEqual(log, [[150, true]]);
  clock.advance(1000); c.stop();
  assert.deepEqual(log, [[150, true], [1150, false]], 'hidden at once: it was visible longer than the minimum');
});

test('a spinner that appears stays for the minimum duration (no flash)', () => {
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); clock.advance(200); c.stop(); // visible at 150, operation ended at 200
  assert.deepEqual(log, [[150, true]]);
  clock.advance(249);
  assert.equal(c.visible, true);
  clock.advance(1);
  assert.deepEqual(log, [[150, true], [450, false]], 'hidden 300 ms after it appeared');
});

test('the minimum display time never delays the operation itself', () => {
  // stop() returns immediately; only the indicator lingers. Starting again re-uses the visible spinner.
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); clock.advance(200); c.stop(); clock.advance(100); c.start();
  clock.advance(1000);
  assert.deepEqual(log, [[150, true]], 'a quick second operation keeps the same spinner, no flicker');
  c.stop(); clock.advance(0);
  assert.deepEqual(log, [[150, true], [1300, false]]);
});

test('repeated start calls do not stack timers', () => {
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); c.start(); c.start();
  assert.equal(clock.pending(), 1);
  clock.advance(150);
  assert.deepEqual(log, [[150, true]]);
});

test('dispose cancels everything (unmount)', () => {
  const clock = fakeClock(); const log = [];
  const c = make(clock, log);
  c.start(); c.dispose(); clock.advance(1000);
  assert.deepEqual(log, []);
  assert.equal(clock.pending(), 0);
});

test('a zero delay shows immediately', () => {
  const clock = fakeClock(); const log = [];
  const c = createSpinnerController({ delay: 0, minimum: 0, onChange: v => log.push(v), timers: clock.timers });
  c.start(); c.stop();
  assert.deepEqual(log, [true, false]);
});

test('switches: the global switch turns every spinner off', () => {
  const base = { ...LOADING_CONFIG };
  assert.equal(spinnersEnabled('navigation', base), true);
  assert.equal(spinnersEnabled('button', { ...base, buttonLoadingEnabled: false }), false);
  assert.equal(spinnersEnabled('navigation', { ...base, navigationLoadingEnabled: false }), false);
  assert.equal(spinnersEnabled('inline', { ...base, globalLoadingEnabled: false }), false);
  assert.equal(spinnersEnabled('button', { ...base, globalLoadingEnabled: false }), false);
});

test('navigationStyle none turns the navigation indicator off', () => {
  assert.equal(spinnersEnabled('navigation', { ...LOADING_CONFIG, navigationStyle: 'none' }), false);
  assert.equal(spinnersEnabled('navigation', { ...LOADING_CONFIG, navigationStyle: 'overlay' }), true);
  assert.equal(spinnersEnabled('button', { ...LOADING_CONFIG, navigationStyle: 'none' }), true);
});

test('visual settings reach CSS as custom properties', () => {
  const vars = loadingCssVars({ ...LOADING_CONFIG, spinnerDelay: 120, spinnerSpeed: 900 });
  assert.equal(vars['--kn-spinner-delay'], '120ms');
  assert.equal(vars['--kn-spinner-speed'], '900ms');
  assert.equal(vars['--kn-c1'], LOADING_CONFIG.spinnerPalette[0]);
  assert.equal(vars['--kn-c4'], LOADING_CONFIG.spinnerPalette[3]);
});

test('a one-colour palette switches the colour cycle off', () => {
  const vars = loadingCssVars({ ...LOADING_CONFIG, spinnerPalette: ['#772337'] });
  assert.deepEqual([vars['--kn-c1'], vars['--kn-c2'], vars['--kn-c3'], vars['--kn-c4']], ['#772337', '#772337', '#772337', '#772337']);
});
