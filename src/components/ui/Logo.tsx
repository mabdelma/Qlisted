interface LogoProps {
  /** Height of the icon mark in px (the wordmark scales with it). */
  size?: number;
  /** 'full' shows mark + wordmark; 'icon' shows just the mark. */
  variant?: 'full' | 'icon';
  /** 'color' = teal/navy wordmark (light backgrounds); 'light' = white wordmark (dark backgrounds). */
  tone?: 'color' | 'light';
  /** Show the "hospitality, handled" tagline under the wordmark. */
  showTagline?: boolean;
  className?: string;
}

/**
 * Qlisted brand lockup. The mark is a "Q" ring in the teal→navy brand gradient,
 * enclosing a cloche (restaurants) and a building (hotels); the wordmark is
 * "Q" (teal) + "listed" (navy) — white throughout on dark surfaces.
 */
export function Logo({
  size = 32,
  variant = 'full',
  tone = 'color',
  showTagline = false,
  className = '',
}: LogoProps) {
  const gradId = 'qlisted-logo-grad';
  const light = tone === 'light';
  const ring = light ? '#ffffff' : `url(#${gradId})`;
  const cloche = light ? '#ffffff' : '#0f766e';
  const building = light ? '#ffffff' : '#1e3a5f';

  const icon = (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Qlisted"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="0.5" stopColor="#0f766e" />
          <stop offset="1" stopColor="#1e3a5f" />
        </linearGradient>
      </defs>
      {/* Q ring + tail */}
      <circle cx="256" cy="240" r="166" fill="none" stroke={ring} strokeWidth={40} />
      <path d="M373 357 L440 424" fill="none" stroke={ring} strokeWidth={40} strokeLinecap="round" />
      {/* cloche (restaurants) */}
      <path d="M138 286 Q138 210 212 210 Q286 210 286 286 Z" fill={cloche} />
      <circle cx="212" cy="203" r="9" fill={cloche} />
      <rect x="130" y="286" width="164" height="14" rx="7" fill={cloche} />
      {/* building (hotels) */}
      <rect x="300" y="168" width="66" height="132" rx="4" fill={building} />
      {!light && (
        <>
          <rect x="311" y="188" width="12" height="12" rx="2" fill="#ffffff" />
          <rect x="343" y="188" width="12" height="12" rx="2" fill="#ffffff" />
          <rect x="311" y="216" width="12" height="12" rx="2" fill="#ffffff" />
          <rect x="343" y="216" width="12" height="12" rx="2" fill="#ffffff" />
          <rect x="311" y="244" width="12" height="12" rx="2" fill="#ffffff" />
          <rect x="343" y="244" width="12" height="12" rx="2" fill="#ffffff" />
          <path d="M325 300 v-24 a8 8 0 0 1 16 0 v24 z" fill="#ffffff" />
        </>
      )}
    </svg>
  );

  if (variant === 'icon') {
    return <span className={className}>{icon}</span>;
  }

  const q = light ? '#ffffff' : '#0f766e';
  const listed = light ? '#ffffff' : '#1e3a5f';
  const tag = light ? 'rgba(255,255,255,0.65)' : '#64748b';
  const wordSize = size * 0.7;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.22 }}
    >
      {icon}
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: wordSize,
            letterSpacing: '-0.01em',
            fontFamily: 'var(--font-display, ui-sans-serif, system-ui, sans-serif)',
          }}
        >
          <span style={{ color: q }}>Q</span>
          <span style={{ color: listed }}>listed</span>
        </span>
        {showTagline && (
          <span
            style={{
              marginTop: size * 0.12,
              fontSize: size * 0.22,
              fontWeight: 600,
              letterSpacing: '0.16em',
              color: tag,
            }}
          >
            HOSPITALITY, HANDLED.
          </span>
        )}
      </span>
    </span>
  );
}

export default Logo;
