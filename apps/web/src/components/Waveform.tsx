/**
 * Decorative audio waveform. Bar heights are derived deterministically from
 * `seed` (FNV-1a + xorshift), so every call renders its own stable
 * "voiceprint". Color comes from the parent via `currentColor`; the parent
 * also sets the height.
 */
function barHeights(seed: string, bars: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(25 + (Math.abs(h) % 75));
  }
  return out;
}

export default function Waveform({
  seed,
  bars = 24,
  animate = false,
  className = '',
}: {
  seed: string;
  bars?: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden className={`flex items-center gap-[3px] ${className}`}>
      {barHeights(seed, bars).map((pct, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full bg-current ${
            animate ? 'animate-wavebar' : ''
          }`}
          style={{
            height: `${pct}%`,
            animationDelay: animate ? `${(i % 8) * 0.13}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
