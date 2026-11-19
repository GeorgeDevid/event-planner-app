"use client";

import { useLingering } from "@/lib/use-lingering";
import { useLiquidIndicator } from "@/lib/use-liquid-indicator";
import Link from "next/link";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] bg-surface p-5 shadow-card ${className}`}>{children}</section>
  );
}

/** Screen title with an optional round back button (vendor sub-pages). */
export function PageHeader({
  title,
  backHref,
  eyebrow,
  action,
}: {
  title: string;
  backHref?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-navy-900 shadow-card"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-xs font-semibold text-gold-text">{eyebrow}</p> : null}
        <h1 className="truncate text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** Thin gold progress bar with "Step 2 of 4 · Categories". */
export function Stepper({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label="Setup progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-gold-500 transition-[width] duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <p className="text-xs font-semibold text-gold-text">
        Step {step} of {total} · {label}
      </p>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4">
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-ink-2">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-control transition-colors peer-checked:bg-navy-900 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-text peer-disabled:opacity-50 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  const { containerRef, indicatorRef } = useLiquidIndicator<HTMLDivElement>(value, '[aria-checked="true"]');
  return (
    <div ref={containerRef} role="radiogroup" aria-label={label} className="relative flex gap-1 rounded-full bg-surface-2 p-1">
      <span ref={indicatorRef} aria-hidden="true" className="liquid-indicator bg-navy-900" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`press relative min-h-10 flex-1 rounded-full px-3 text-sm font-semibold duration-300 ${
            value === o.value ? "text-white" : "text-ink-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextArea({
  id,
  label,
  helper,
  error,
  maxLength,
  value,
  ...rest
}: ComponentProps<"textarea"> & {
  id: string;
  label: string;
  helper?: string;
  error?: string | null;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-meta`}
        className={`min-h-32 rounded-2xl border bg-surface px-4 py-3 text-[15px] focus:outline-none focus-visible:outline-3 focus-visible:outline-gold-text ${
          error ? "border-danger" : "border-control"
        }`}
        {...rest}
      />
      <div id={`${id}-meta`} className="flex justify-between gap-4 text-[13px]">
        <span className={error ? "font-medium text-danger" : "text-ink-2"}>{error ?? helper}</span>
        {maxLength ? (
          <span className="shrink-0 text-ink-2">
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Bottom sheet on phones, centred dialog on larger screens. Uses the native
 * <dialog> so focus is trapped and Escape closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const showContent = useLingering(open, 450);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="sheet-title"
      className="dialog-sheet backdrop-fade m-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-ink shadow-float backdrop:bg-navy-900/45 sm:m-auto sm:max-w-lg sm:rounded-[24px]"
    >
      <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-6">
        <div aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-[#d9d2c6] sm:hidden" />
        <div className="flex items-center justify-between gap-4">
          <h2 id="sheet-title" className="text-[20px] font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {showContent ? children : null}
      </div>
    </dialog>
  );
}

/** Placeholder for an empty photo slot, in the dusk style. */
export function PhotoPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-dusk ${className}`}>
      <span className="absolute bottom-2 left-2 rounded-full bg-navy-900/55 px-2.5 py-1 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  );
}
