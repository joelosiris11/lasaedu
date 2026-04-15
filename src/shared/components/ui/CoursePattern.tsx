// Geometric red-family pattern used when a course has no image.
// Six deterministic variants picked via hash of a stable course key.
// Use `circle` to clip the pattern inside a round frame (for avatars).

type PatternVariant = 'triangles' | 'cubes' | 'chevrons' | 'diamonds' | 'dots' | 'waves';

const VARIANTS: { variant: PatternVariant; bg: string; fg: string; accent: string }[] = [
  { variant: 'triangles', bg: '#dc2626', fg: '#ef4444', accent: '#fecaca' },
  { variant: 'cubes',     bg: '#b91c1c', fg: '#dc2626', accent: '#fca5a5' },
  { variant: 'chevrons',  bg: '#e11d48', fg: '#f43f5e', accent: '#fecdd3' },
  { variant: 'diamonds',  bg: '#991b1b', fg: '#b91c1c', accent: '#fecaca' },
  { variant: 'dots',      bg: '#dc2626', fg: '#fca5a5', accent: '#ffffff' },
  { variant: 'waves',     bg: '#be123c', fg: '#e11d48', accent: '#fda4af' },
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function pickVariant(key: string) {
  return VARIANTS[hashKey(key) % VARIANTS.length];
}

export function CoursePattern({
  courseKey,
  circle = false,
  className = '',
}: {
  courseKey: string;
  circle?: boolean;
  className?: string;
}) {
  const { variant, bg, fg, accent } = pickVariant(courseKey);
  const id = `pat-${variant}-${hashKey(courseKey).toString(36)}`;

  const defs = (() => {
    switch (variant) {
      case 'triangles':
        return (
          <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
            <polygon points="14,2 26,24 2,24" fill={fg} opacity="0.55" />
            <polygon points="14,26 26,4 2,4" fill={accent} opacity="0.25" />
          </pattern>
        );
      case 'cubes':
        return (
          <pattern id={id} width="30" height="34" patternUnits="userSpaceOnUse">
            <polygon points="15,2 28,9 28,25 15,32 2,25 2,9" fill={fg} opacity="0.5" />
            <polygon points="15,2 15,17 2,9" fill={accent} opacity="0.35" />
            <polygon points="15,2 15,17 28,9" fill={accent} opacity="0.15" />
          </pattern>
        );
      case 'chevrons':
        return (
          <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 18 L12 6 L24 18" stroke={accent} strokeWidth="3" fill="none" opacity="0.55" />
            <path d="M0 10 L12 -2 L24 10" stroke={fg} strokeWidth="3" fill="none" opacity="0.6" />
          </pattern>
        );
      case 'diamonds':
        return (
          <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
            <polygon points="13,2 24,13 13,24 2,13" fill={fg} opacity="0.55" />
            <polygon points="13,8 18,13 13,18 8,13" fill={accent} opacity="0.45" />
          </pattern>
        );
      case 'dots':
        return (
          <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="4" fill={fg} opacity="0.8" />
            <circle cx="0" cy="0" r="2" fill={accent} opacity="0.45" />
            <circle cx="22" cy="22" r="2" fill={accent} opacity="0.45" />
          </pattern>
        );
      case 'waves':
      default:
        return (
          <pattern id={id} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 Q10 0 20 10 T40 10" stroke={accent} strokeWidth="2" fill="none" opacity="0.6" />
            <path d="M0 16 Q10 6 20 16 T40 16" stroke={fg} strokeWidth="2" fill="none" opacity="0.5" />
          </pattern>
        );
    }
  })();

  return (
    <svg
      className={className}
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {defs}
        {circle && (
          <clipPath id={`${id}-clip`}>
            <circle cx="100" cy="60" r="60" />
          </clipPath>
        )}
      </defs>
      <g clipPath={circle ? `url(#${id}-clip)` : undefined}>
        <rect width="200" height="120" fill={bg} />
        <rect width="200" height="120" fill={`url(#${id})`} />
        <rect width="200" height="120" fill={`url(#${id}-shine)`} opacity="0.15" />
      </g>
      <defs>
        <linearGradient id={`${id}-shine`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default CoursePattern;
