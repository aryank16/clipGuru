/**
 * Placeholder artwork for a video card until renders bring real thumbnails (F12).
 * A quiet line drawing picked from the id, so each card looks different but stays calm.
 */
export function Thumbnail({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const variant = h % 5;
  const ink = "var(--color-espresso)";
  const gold = "var(--color-sand-gold)";
  const faint = "var(--color-taupe)";
  return (
    <svg viewBox="0 0 90 160" className="size-full" aria-hidden>
      <rect width="90" height="160" fill="var(--color-surface-warm)" />
      {variant === 0 && (
        <g fill="none" strokeWidth="1.4">
          <path d="M18 112 Q45 108 62 60" stroke={ink} />
          <rect x="26" y="92" width="5" height="22" fill={faint} opacity=".25" stroke="none" />
          <rect x="38" y="80" width="5" height="34" fill={gold} stroke="none" />
          <rect x="50" y="64" width="5" height="50" fill={ink} stroke="none" />
          <circle cx="62" cy="60" r="2.5" fill={ink} />
        </g>
      )}
      {variant === 1 && (
        <g fill="none" strokeWidth="1.2">
          <circle cx="45" cy="80" r="20" stroke={ink} />
          <circle cx="45" cy="80" r="11" stroke={gold} />
          <circle cx="45" cy="80" r="3" fill={ink} stroke="none" />
          <circle cx="56" cy="80" r="2.2" fill="var(--color-render-orange)" stroke="none" />
        </g>
      )}
      {variant === 2 && (
        <g fill="none" strokeWidth="1.2">
          <rect x="22" y="58" width="22" height="26" stroke={ink} />
          <rect x="46" y="86" width="22" height="26" fill={gold} fillOpacity=".35" stroke={gold} />
          <path d="M30 66 L60 104" stroke={ink} strokeDasharray="2 3" />
          <circle cx="60" cy="104" r="2.2" fill={ink} stroke="none" />
        </g>
      )}
      {variant === 3 && (
        <g fill="none" strokeWidth="1.4">
          <path d="M16 80 C24 60 30 100 38 80 S52 60 60 80 S70 92 76 80" stroke={ink} />
          <rect x="47" y="56" width="6" height="52" fill={ink} stroke="none" />
          <path d="M18 118 H72" stroke={faint} opacity=".4" />
        </g>
      )}
      {variant === 4 && (
        <g fill="none" strokeWidth="1.3">
          <path d="M20 100 Q45 50 70 100" stroke={ink} />
          <path d="M20 100 H70" stroke={gold} strokeDasharray="2 3" />
          <circle cx="20" cy="100" r="2" fill={ink} stroke="none" />
          <circle cx="70" cy="100" r="2" fill={ink} stroke="none" />
          <circle cx="45" cy="75" r="2.6" fill={ink} stroke="none" />
        </g>
      )}
    </svg>
  );
}
