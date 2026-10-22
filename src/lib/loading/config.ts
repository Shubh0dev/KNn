/**
 * Loading-indicator settings: the one place to tune spinner timing.
 *
 * These values only control when a spinner is SHOWN. They never delay a
 * request, navigation or form submission: an operation that finishes before
 * `spinnerDelay` shows no spinner at all.
 */
export const LOADING_CONFIG = {
  /** Wait this long (ms) before showing a spinner, so fast operations never flicker. */
  spinnerDelay: 150,
  /** Once visible, keep the spinner at least this long (ms) so it never flashes. */
  minimumSpinnerDuration: 300,
  /** Hide the navigation indicator after this long (ms) even if no page change is seen. */
  navigationTimeout: 15_000,
  /** Small indicator while moving between pages. */
  navigationLoadingEnabled: true,
  /** Spinner and "Saving…" label inside buttons (buttons are disabled while busy either way). */
  buttonLoadingEnabled: true,
  /** Master switch for every spinner. */
  globalLoadingEnabled: true,
};

export type LoadingConfig = typeof LOADING_CONFIG;

export const spinnersEnabled = (kind: 'navigation' | 'button' | 'inline', config: LoadingConfig = LOADING_CONFIG) =>
  config.globalLoadingEnabled && (kind === 'navigation' ? config.navigationLoadingEnabled : kind === 'button' ? config.buttonLoadingEnabled : true);
