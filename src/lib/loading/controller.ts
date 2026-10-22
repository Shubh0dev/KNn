// Spinner visibility timing, independent of React (unit-tested with a fake clock).
// It only decides when to show and hide an indicator; it never touches the operation itself.

export type TimerApi = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
  now: () => number;
};

const realTimers: TimerApi = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: id => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export type SpinnerController = {
  /** The operation started (or is still running). */
  start: () => void;
  /** The operation finished, failed or was cancelled. */
  stop: () => void;
  /** Cancel timers (component unmounted). */
  dispose: () => void;
  readonly visible: boolean;
};

/**
 * - Shows the spinner only if the operation is still running after `delay` ms.
 * - Once shown, keeps it for at least `minimum` ms, then hides it.
 * - An operation that ends before `delay` never shows a spinner.
 */
export function createSpinnerController(options: {
  delay: number; minimum: number; onChange: (visible: boolean) => void; timers?: TimerApi;
}): SpinnerController {
  const t = options.timers ?? realTimers;
  let visible = false;
  let shownAt = 0;
  let showTimer: unknown = null;
  let hideTimer: unknown = null;

  const clearShow = () => { if (showTimer !== null) { t.clear(showTimer); showTimer = null; } };
  const clearHide = () => { if (hideTimer !== null) { t.clear(hideTimer); hideTimer = null; } };
  const show = () => { showTimer = null; visible = true; shownAt = t.now(); options.onChange(true); };
  const hide = () => { hideTimer = null; if (!visible) return; visible = false; options.onChange(false); };

  return {
    start() {
      clearHide();
      if (visible || showTimer !== null) return;
      if (options.delay <= 0) show();
      else showTimer = t.set(show, options.delay);
    },
    stop() {
      if (showTimer !== null) { clearShow(); return; }
      if (!visible || hideTimer !== null) return;
      const remaining = options.minimum - (t.now() - shownAt);
      if (remaining <= 0) hide();
      else hideTimer = t.set(hide, remaining);
    },
    dispose() { clearShow(); clearHide(); },
    get visible() { return visible; },
  };
}
