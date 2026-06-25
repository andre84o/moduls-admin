/**
 * Brand wordmark — shared, reusable. Receives all content via props so it
 * holds no customer-specific text. Used by the public header and footer.
 */
export function Brand({
  primary,
  accent,
  accentClassName = "text-indigo-600",
  className = "text-xl font-semibold tracking-tight text-zinc-900",
}: {
  primary: string;
  accent: string;
  accentClassName?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {primary}
      <span className={accentClassName}>{accent}</span>
    </span>
  );
}
