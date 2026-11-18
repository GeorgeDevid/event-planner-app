import { query } from "./_generated/server";
import { requirePermission } from "./lib/access";

/**
 * Totals for the admin dashboard (A-02). Requires users:view; each block
 * beyond that is only filled in when the admin may view that module.
 */
export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "users:view");

    const users = await ctx.db.query("users").collect();
    const vendors = await ctx.db.query("vendors").collect();

    const count = <T>(rows: T[], pick: (row: T) => string) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        const key = pick(row);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    return {
      usersByRole: count(users, (u) => u.role),
      vendorsByStatus: count(vendors, (v) => v.status),
      pendingVendorApprovals: vendors.filter((v) => v.status === "pending").length,
    };
  },
});
