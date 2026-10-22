/**
 * Small circular spinner. Inside buttons it inherits the text colour and is
 * hidden from screen readers (the button carries aria-busy and its label);
 * standalone, pass `label` so it is announced.
 */
export function CircularLoader({ size = 'sm', label, className = '', delayed = false }: {
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  className?: string;
  /** Fade in after the configured spinner delay (CSS only), for server-rendered fallbacks. */
  delayed?: boolean;
}) {
  return <span
    className={`kn-loader kn-loader-${size}${delayed ? ' kn-loader-delayed' : ''}${className ? ` ${className}` : ''}`}
    {...(label ? { role: 'status', 'aria-live': 'polite' as const } : { 'aria-hidden': true })}
  >
    <span className="kn-loader-ring" aria-hidden="true" />
    {label && <span className="kn-sr-only">{label}</span>}
  </span>;
}
