"use client";

import { useId, useState } from "react";

const STAR = "M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.3 6.37L12 17.02l-5.72 3.2 1.3-6.37-4.78-4.4 6.45-.75z";

function Star({ fill, size }: { fill: number; size: number }) {
  // fill: 0 to 1, so averages like 4.5 show half a star.
  const id = useId();
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--color-gold-500)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--color-line)" />
        </linearGradient>
      </defs>
      <path d={STAR} fill={`url(#${id})`} stroke="var(--color-gold-600)" strokeWidth={fill > 0 ? 0.6 : 0} strokeLinejoin="round" />
    </svg>
  );
}

/** Read-only stars, e.g. 4.6 out of 5. */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span role="img" aria-label={`${Math.round(v * 10) / 10} out of 5 stars`} className={`inline-flex items-center gap-0.5 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={Math.max(0, Math.min(1, v - i))} />
      ))}
    </span>
  );
}

/** "★ 4.6 (12)" — compact rating for cards. Shows nothing when there are no reviews. */
export function RatingBadge({ average, count, className = "" }: { average: number | null; count: number; className?: string }) {
  if (!count || average === null) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-semibold text-ink ${className}`}>
      <Stars value={average} size={14} />
      <span>{average.toFixed(1)}</span>
      <span className="font-normal text-ink-2">({count})</span>
    </span>
  );
}

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Star picker: a radio group, so arrow keys work and screen readers announce the choice. */
export function StarInput({
  value,
  onChange,
  label = "Rating",
  error,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string | null;
}) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-xs font-semibold text-ink-2">{label}</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="press flex size-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text" onMouseEnter={() => setHover(n)}>
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={`${n} star${n > 1 ? "s" : ""}, ${LABELS[n]}`} />
              <Star size={30} fill={n <= shown ? 1 : 0} />
            </label>
          ))}
        </div>
        <span className="text-sm font-semibold text-ink-2" aria-hidden="true">{shown ? LABELS[shown] : ""}</span>
      </div>
      {error ? <p id={`${name}-error`} className="text-[13px] font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}
