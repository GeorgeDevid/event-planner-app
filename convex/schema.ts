import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  adminRole,
  bookingStatus,
  eventStatus,
  inquiryStatus,
  priceType,
  priceUnit,
  questionType,
  userRole,
  userStatus,
  vendorStatus,
} from "./lib/validators";

/**
 * Phase 0 data model (no payments).
 *
 * Money is stored in cents (CAD). Dates of events are ISO `YYYY-MM-DD`
 * strings; timestamps are milliseconds since epoch.
 */
export default defineSchema({
  // App users. Convex Auth owns credentials and sessions in its components;
  // this table owns the profile, the role and the account status.
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    role: userRole,
    // Only set when role === "admin" (see A-10 roles and permissions).
    adminRole: v.optional(adminRole),
    status: userStatus,
    onboarded: v.boolean(),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    // Set when an admin deletes the account; personal data is anonymised (A-03).
    deletedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  // Service categories (A-05). Subcategories point at their parent.
  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    icon: v.string(),
    order: v.number(),
    active: v.boolean(),
    parentId: v.optional(v.id("categories")),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"]),

  // Event types with their questions and pre-selected services (A-06, C-05, C-06).
  eventTypes: defineTable({
    name: v.string(),
    slug: v.string(),
    order: v.number(),
    active: v.boolean(),
    defaultCategorySlugs: v.array(v.string()),
    // Sub-functions such as the wedding functions; each collects its own
    // date, guest count and venue.
    subFunctions: v.array(v.string()),
    questions: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        type: questionType,
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
      }),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"]),

  // Vendor businesses (V-01 to V-04, A-04).
  vendors: defineTable({
    ownerId: v.id("users"),
    companyName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
    categoryIds: v.array(v.id("categories")),
    about: v.optional(v.string()),
    address: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    serviceRadiusKm: v.number(),
    clientsComeToMe: v.boolean(),
    // V-05: whether a day with an accepted booking stays open for more.
    multipleBookingsPerDay: v.optional(v.boolean()),
    status: vendorStatus,
    verified: v.boolean(),
    featured: v.boolean(),
    rejectionReason: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    logoId: v.optional(v.id("_storage")),
    submittedAt: v.optional(v.number()),
    // Mean of active package prices, kept up to date by the packages
    // mutations so search and cards never compute it on the fly (C-09, V-04).
    avgPriceCents: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]),

  // Portfolio photos (V-03), up to 30 per vendor, shown in `order`.
  vendorImages: defineTable({
    vendorId: v.id("vendors"),
    storageId: v.id("_storage"),
    order: v.number(),
  }).index("by_vendor_order", ["vendorId", "order"]),

  // Supporting documents for approval (V-01): licence or ID, admin-only.
  vendorDocuments: defineTable({
    vendorId: v.id("vendors"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
  }).index("by_vendor", ["vendorId"]),

  packages: defineTable({
    vendorId: v.id("vendors"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    priceType: priceType,
    unit: priceUnit,
    active: v.boolean(),
  }).index("by_vendor", ["vendorId"]),

  // Days a vendor is unavailable (V-05).
  blockedDates: defineTable({
    vendorId: v.id("vendors"),
    date: v.string(),
  }).index("by_vendor_date", ["vendorId", "date"]),

  // Client events (C-04 to C-07, C-15).
  events: defineTable({
    clientId: v.id("users"),
    eventTypeId: v.id("eventTypes"),
    name: v.string(),
    date: v.optional(v.string()),
    address: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    guestCount: v.optional(v.number()),
    budgetMinCents: v.optional(v.number()),
    budgetMaxCents: v.optional(v.number()),
    // Answers to the event type's questions, keyed by question key.
    answers: v.record(v.string(), v.any()),
    functions: v.array(
      v.object({
        name: v.string(),
        date: v.optional(v.string()),
        guestCount: v.optional(v.number()),
        venue: v.optional(v.string()),
      }),
    ),
    selectedCategoryIds: v.array(v.id("categories")),
    shortlistedVendorIds: v.array(v.id("vendors")),
    status: eventStatus,
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),

  // Inquiries and quotes (C-12, V-06).
  inquiries: defineTable({
    clientId: v.id("users"),
    vendorId: v.id("vendors"),
    eventId: v.optional(v.id("events")),
    categoryId: v.optional(v.id("categories")),
    message: v.string(),
    status: inquiryStatus,
    createdAt: v.number(),
  })
    .index("by_vendor", ["vendorId"])
    .index("by_client", ["clientId"])
    .index("by_event_vendor", ["eventId", "vendorId"]),

  // Booking requests (C-14, V-07). Payment is arranged outside the app.
  bookings: defineTable({
    clientId: v.id("users"),
    vendorId: v.id("vendors"),
    eventId: v.optional(v.id("events")),
    serviceDate: v.string(),
    packageId: v.optional(v.id("packages")),
    agreedPriceCents: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: bookingStatus,
    statusReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_vendor", ["vendorId"])
    .index("by_client", ["clientId"])
    .index("by_event", ["eventId"]),

  // Read-only record of sensitive changes (A-11).
  auditLog: defineTable({
    actorId: v.optional(v.id("users")),
    actorRole: v.optional(v.string()),
    action: v.string(),
    module: v.string(),
    targetTable: v.optional(v.string()),
    targetId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_actor", ["actorId"])
    .index("by_module", ["module"]),
});
