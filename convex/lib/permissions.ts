import type { AdminRole } from "./validators";

/**
 * Admin permissions (A-10). Every admin-only Convex function checks one of
 * these on the server; hiding a button in the UI is never enough.
 */
export const MODULES = [
  "users",
  "vendors",
  "categories",
  "eventTypes",
  "events",
  "bookings",
  "messages",
  "reports",
  "content",
  "roles",
  "auditLog",
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "suspend",
  "resetPassword",
] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}:${Action}`;

const ALL: Action[] = ["view", "create", "edit", "delete", "approve", "suspend"];

/** Default permission matrix, as agreed in story A-10. */
const MATRIX: Record<AdminRole, Partial<Record<Module, Action[]>>> = {
  super_admin: {
    users: [...ALL, "resetPassword"],
    vendors: ALL,
    categories: ALL,
    eventTypes: ALL,
    events: ALL,
    bookings: ALL,
    messages: ["view"],
    reports: ALL,
    content: ALL,
    roles: ALL,
    auditLog: ["view"],
  },
  admin: {
    users: ["view", "edit", "suspend"],
    vendors: ALL,
    categories: ALL,
    eventTypes: ALL,
    events: ["view", "edit"],
    bookings: ["view", "edit"],
    messages: ["view"],
    reports: ALL,
    content: ALL,
    auditLog: ["view"],
  },
  moderator: {
    users: ["view"],
    vendors: ["view", "suspend"],
    events: ["view"],
    bookings: ["view"],
    // Moderators read messages only when they have been reported; the
    // messages functions enforce that extra condition.
    messages: ["view"],
    reports: ALL,
  },
  support: {
    users: ["view", "resetPassword"],
    vendors: ["view"],
    categories: ["view"],
    eventTypes: ["view"],
    events: ["view"],
    bookings: ["view"],
    reports: ["view"],
  },
};

export function hasPermission(
  role: AdminRole | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const [module, action] = permission.split(":") as [Module, Action];
  return MATRIX[role][module]?.includes(action) ?? false;
}

export function permissionsFor(role: AdminRole | undefined): Permission[] {
  if (!role) return [];
  return Object.entries(MATRIX[role]).flatMap(([module, actions]) =>
    (actions ?? []).map((action) => `${module}:${action}` as Permission),
  );
}
