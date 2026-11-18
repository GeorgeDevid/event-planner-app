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
export const DEFAULT_MATRIX: Record<string, Partial<Record<Module, Action[]>>> = {
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

/** Default permissions of a built-in role (empty for unknown keys). */
export function defaultPermissions(role: AdminRole | undefined): Permission[] {
  if (!role || !DEFAULT_MATRIX[role]) return [];
  return Object.entries(DEFAULT_MATRIX[role]).flatMap(([module, actions]) =>
    (actions ?? []).map((action) => `${module}:${action}` as Permission),
  );
}

/** Which actions make sense for each module, for the roles editor. */
export const APPLICABLE: Record<Module, Action[]> = {
  users: ["view", "edit", "delete", "suspend", "resetPassword"],
  vendors: ["view", "edit", "delete", "approve", "suspend"],
  categories: ["view", "create", "edit", "delete"],
  eventTypes: ["view", "create", "edit", "delete"],
  events: ["view", "edit"],
  bookings: ["view", "edit"],
  messages: ["view"],
  reports: ["view", "edit"],
  content: ["view", "create", "edit", "delete"],
  roles: ["view", "create", "edit", "delete"],
  auditLog: ["view"],
};

export const ALL_PERMISSIONS: Permission[] = (Object.keys(APPLICABLE) as Module[]).flatMap((m) =>
  APPLICABLE[m].map((a) => `${m}:${a}` as Permission),
);

export const isPermission = (p: string): p is Permission => (ALL_PERMISSIONS as string[]).includes(p);
