/**
 * Loading-indicator settings: the one place to tune spinners and loading screens.
 *
 * These values only control when and how an indicator is SHOWN. They never delay a
 * request, navigation or form submission: an operation that finishes before
 * `spinnerDelay` shows no spinner at all, and every indicator hides as soon as the
 * operation it tracks has finished (after at most `minimumSpinnerDuration`).
 */
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export const LOADING_CONFIG = {
  /** Wait this long (ms) before showing a spinner, so fast operations never flicker. */
  spinnerDelay: 150,
  /** Once visible, keep the spinner at least this long (ms) so it never flashes. */
  minimumSpinnerDuration: 200,
  /** Hide the navigation indicator after this long (ms) even if no page change is seen. */
  navigationTimeout: 15_000,
  /** One full turn of the spinner ring (ms). */
  spinnerSpeed: 800,
  /** Fallback spinner colour (theme token). Buttons always use their own text colour. */
  spinnerColor: 'hsl(var(--accent))',
  /**
   * Standalone spinners (page, section, navigation) change colour once per complete rotation,
   * cycling through these KashiNagri brand colours: maroon, saffron, temple gold, leaf green.
   * Use a single colour to switch the cycle off.
   */
  spinnerPalette: ['#772337', 'hsl(var(--accent))', '#9d6d2b', '#38591f'],
  /** Spinner size per context: small for buttons, medium for sections, large for whole pages. */
  sizes: { button: 'xs', inline: 'xs', navigation: 'lg', section: 'md', page: 'lg' } satisfies Record<string, SpinnerSize>,
  /**
   * While the next page loads:
   * 'spinner' = centred "Loading…" card (does not block clicks); 'overlay' = pill plus a subtle fade of the content
   * area (header and sidebar stay usable); 'none' = no indicator.
   */
  navigationStyle: 'spinner' as 'spinner' | 'overlay' | 'none',
  /** Route loading screens (loading.tsx): layout-matching skeletons, or a centred spinner. */
  routeFallback: 'skeleton' as 'skeleton' | 'spinner',
  /** Small indicator while moving between pages (see navigationStyle). */
  navigationLoadingEnabled: true,
  /** Spinner and "Saving…" label inside buttons (buttons are disabled while busy either way). */
  buttonLoadingEnabled: true,
  /** Master switch for every spinner. */
  globalLoadingEnabled: true,
};

export type LoadingConfig = typeof LOADING_CONFIG;

export const spinnersEnabled = (kind: 'navigation' | 'button' | 'inline', config: LoadingConfig = LOADING_CONFIG) =>
  config.globalLoadingEnabled && (kind === 'navigation'
    ? config.navigationLoadingEnabled && config.navigationStyle !== 'none'
    : kind === 'button' ? config.buttonLoadingEnabled : true);

/** CSS custom properties that carry the visual settings to the stylesheet (set on <body>). */
export const loadingCssVars = (config: LoadingConfig = LOADING_CONFIG): Record<string, string> => ({
  '--kn-spinner-delay': `${config.spinnerDelay}ms`,
  '--kn-spinner-speed': `${config.spinnerSpeed}ms`,
  '--kn-spinner-color': config.spinnerColor,
  // Four palette slots; fewer colours repeat, so one colour means no colour change.
  ...Object.fromEntries([0, 1, 2, 3].map(i => [`--kn-c${i + 1}`, config.spinnerPalette[i % config.spinnerPalette.length] ?? config.spinnerColor])),
});
