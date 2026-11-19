"use client";

import { useLingering } from "@/lib/use-lingering";
import { useLiquidIndicator } from "@/lib/use-liquid-indicator";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";

export function AdminHeader({
  title,
  accent,
  description,
  actions,
}: {
  title: string;
  accent?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">
          {title} {accent ? <span className="text-gold-display">{accent}</span> : null}
        </h1>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SearchInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-control bg-surface px-4 focus-within:outline-3 focus-within:outline-gold-text sm:max-w-sm">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-2 focus:outline-none"
      />
    </label>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-full border border-control bg-surface pr-2 pl-4 text-sm focus-within:outline-3 focus-within:outline-gold-text">
      <span className="text-ink-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className="h-full bg-transparent font-semibold focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  label: string;
}) {
  // The navy pill flows over the white chips to the selected tab.
  const { containerRef, indicatorRef } = useLiquidIndicator<HTMLDivElement>(value, '[aria-selected="true"]');
  return (
    <div ref={containerRef} role="tablist" aria-label={label} className="relative flex flex-wrap gap-2">
      <span ref={indicatorRef} aria-hidden="true" className="liquid-indicator z-[1] bg-navy-900" />
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`press relative flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold duration-300 ${
              active ? "z-[2] text-white" : "z-0 bg-surface text-navy-900 shadow-card hover:bg-surface-2"
            }`}
          >
            {t.label}
            {t.count !== undefined ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-navy-700 text-gold-300" : "bg-surface-2 text-ink-2"}`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** White table card that scrolls sideways on small screens. */
export function TableCard({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-[20px] bg-surface shadow-card">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = "border-b border-line px-4 py-3 text-xs font-semibold text-ink-2";
export const td = "border-b border-line px-4 py-3 align-middle";

export function Initials({ name }: { name: string | null }) {
  const text = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-300 text-xs font-bold text-navy-900">
      {text}
    </span>
  );
}

/** Right-hand drawer over a navy scrim; native <dialog> traps focus and Escape closes it. */
export function Drawer({
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
  const showContent = useLingering(open, 400);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="dialog-drawer backdrop-fade m-0 ml-auto h-dvh max-h-none w-full max-w-[520px] rounded-l-[24px] bg-surface p-0 text-ink shadow-float backdrop:bg-navy-900/45"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="truncate text-[20px] font-bold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="press flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{showContent ? children : null}</div>
      </div>
    </dialog>
  );
}

/**
 * Confirmation that names the action, explains the consequence and asks for
 * a required reason (design brief: destructive actions need a reason).
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  consequence,
  confirmLabel,
  tone = "danger",
  reasonLabel = "Reason",
  reasonHelper,
  requireReason = true,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  consequence: string;
  confirmLabel: string;
  tone?: "danger" | "navy" | "gold";
  reasonLabel?: string;
  reasonHelper?: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setReason("");
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const ready = !requireReason || reason.trim().length >= 5;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="reason-title"
      className="dialog-modal backdrop-fade m-auto w-[calc(100%-2rem)] max-w-md rounded-[24px] bg-surface p-0 text-ink shadow-float backdrop:bg-navy-900/45"
    >
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            await onConfirm(reason);
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 id="reason-title" className="text-[20px] font-bold">
          {title}
        </h2>
        <p className="text-sm text-ink-2">{consequence}</p>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-xs font-semibold text-ink-2">
            {reasonLabel}
            {requireReason ? "" : " (optional)"}
          </label>
          <textarea
            id="reason"
            value={reason}
            maxLength={1000}
            required={requireReason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="reason-help"
            className="min-h-28 rounded-2xl border border-control px-4 py-3 text-[15px] focus:outline-none focus-visible:outline-3 focus-visible:outline-gold-text"
          />
          <p id="reason-help" className="text-[13px] text-ink-2">
            {reasonHelper ?? (requireReason ? "At least 5 characters. Saved in the audit log." : "Saved in the audit log.")}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={tone} disabled={!ready || pending}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

const rtf = new Intl.RelativeTimeFormat("en-CA", { numeric: "auto" });
export function timeAgo(ms: number) {
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ms).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-ink-2">
        {children}
      </td>
    </tr>
  );
}
