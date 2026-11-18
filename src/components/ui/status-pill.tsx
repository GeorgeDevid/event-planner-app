type Tone = "pending" | "success" | "danger" | "muted" | "info";

const tones: Record<Tone, string> = {
  pending: "bg-pending-bg text-pending",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  muted: "bg-muted-bg text-muted",
  info: "bg-info-bg text-info",
};

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Vendor approval status → pill (V-01, A-04). */
export function VendorStatusPill({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <StatusPill tone="success">Approved</StatusPill>;
    case "rejected":
      return <StatusPill tone="danger">Changes needed</StatusPill>;
    case "suspended":
      return <StatusPill tone="muted">Suspended</StatusPill>;
    case "deactivated":
      return <StatusPill tone="muted">Deactivated</StatusPill>;
    default:
      return <StatusPill tone="pending">Pending review</StatusPill>;
  }
}
