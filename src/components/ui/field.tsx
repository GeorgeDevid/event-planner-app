import type { ComponentProps } from "react";

/** Label above the field, helper or error below it (design brief: labels never placeholder-only). */
export function TextField({
  id,
  label,
  helper,
  error,
  className = "",
  ...input
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  helper?: string;
  error?: string | null;
}) {
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-[52px] rounded-2xl border bg-surface px-4 text-[15px] text-ink placeholder:text-ink-2/80 focus:outline-none focus-visible:outline-3 focus-visible:outline-gold-text ${
          error ? "border-danger" : "border-control"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-[13px] text-ink-2">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "info";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
        tone === "error" ? "bg-danger-bg text-danger" : "bg-info-bg text-info"
      }`}
    >
      {children}
    </div>
  );
}
