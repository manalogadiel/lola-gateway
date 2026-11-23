export type DotTone = "mint" | "amber" | "peri" | "coral";

interface StatusDotProps {
  tone: DotTone;
  label: string;
  compact?: boolean;
}

export function StatusDot({ tone, label, compact = false }: StatusDotProps) {
  return (
    <span className={`status-inline${compact ? " compact" : ""}`}>
      <span className={`dot dot-${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
