"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { AdminHeader, EmptyRow, formatDateTime, ReasonDialog, TableCard, Tabs, td, th } from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Stars } from "@/components/ui/stars";
import { errorMessage } from "@/lib/errors";

type Filter = "all" | "low" | "hidden";
type Row = FunctionReturnType<typeof api.reviews.adminList>[number];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "1–2 stars" },
  { value: "hidden", label: "Hidden" },
];

/** Client reviews of vendors. Hiding one removes it from the profile and the vendor's rating. */
export default function AdminReviews() {
  const me = useMe();
  const canEdit = me.permissions.includes("reports:edit");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useQuery(api.reviews.adminList, { filter });
  const setHidden = useMutation(api.reviews.setHidden);
  const [hiding, setHiding] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader title="Vendor" accent="reviews" description="Star ratings clients left after their bookings. Hide a review that breaks the rules; the client is told why." />
      <Tabs label="Filter" value={filter} onChange={setFilter} tabs={FILTERS} />
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TableCard caption="Vendor reviews">
        <thead>
          <tr>
            <th scope="col" className={th}>Rating</th>
            <th scope="col" className={th}>Review</th>
            <th scope="col" className={th}>Vendor</th>
            <th scope="col" className={th}>Client</th>
            <th scope="col" className={th}>When</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={6}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6}>No reviews here.</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id} className="border-t border-line align-top">
                <td className={td}>
                  <Stars value={r.rating} size={14} />
                  {r.hidden ? <p className="mt-1 text-xs font-semibold text-danger">Hidden</p> : null}
                </td>
                <td className={`${td} max-w-sm`}>
                  {r.body ? <p className="line-clamp-4 whitespace-pre-line">{r.body}</p> : <p className="text-ink-2">No text</p>}
                  {r.reply ? <p className="mt-2 line-clamp-2 text-xs text-ink-2">Vendor replied: {r.reply}</p> : null}
                  {r.hidden && r.hiddenReason ? <p className="mt-2 text-xs text-ink-2">Hidden because: {r.hiddenReason}</p> : null}
                </td>
                <td className={td}>
                  <Link href={`/vendors/${r.vendor._id}`} className="font-semibold hover:underline" target="_blank">{r.vendor.companyName}</Link>
                </td>
                <td className={td}>
                  <p className="font-semibold">{r.client.name}</p>
                  {r.client.email ? <p className="text-xs text-ink-2">{r.client.email}</p> : null}
                </td>
                <td className={`${td} whitespace-nowrap text-ink-2`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}>
                  {canEdit ? (
                    r.hidden ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-10 px-4 text-sm"
                        onClick={() => setHidden({ reviewId: r._id, hidden: false }).catch((e) => setError(errorMessage(e)))}
                      >
                        Show again
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => setHiding(r)}>
                        Hide
                      </Button>
                    )
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
      <ReasonDialog
        open={hiding !== null}
        onClose={() => setHiding(null)}
        title="Hide this review?"
        consequence="It disappears from the vendor's profile and no longer counts toward their rating. The client is told the reason."
        confirmLabel="Hide review"
        reasonHelper="For example: personal information, abusive language, or not about this vendor."
        onConfirm={async (reason) => {
          if (!hiding) return;
          await setHidden({ reviewId: hiding._id, hidden: true, reason });
          setHiding(null);
        }}
      />
    </div>
  );
}
