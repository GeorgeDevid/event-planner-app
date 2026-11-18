export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream"
    >
      <span
        aria-hidden="true"
        className="size-10 animate-spin rounded-full border-4 border-surface-2 border-t-gold-500 motion-reduce:animate-none"
      />
      <span className="text-sm font-medium text-ink-2">{label}…</span>
    </div>
  );
}
