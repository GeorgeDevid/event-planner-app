import { internalMutation } from "./_generated/server";

/**
 * Starting categories (A-05) and event types (A-06). Idempotent: rows that
 * already exist (matched by slug) are left alone, so it's safe to run again.
 *
 * `npx convex run seed:run`
 */
const CATEGORIES = [
  { name: "Event planners", slug: "event-planners", icon: "clipboard" },
  { name: "Photography", slug: "photography", icon: "camera" },
  { name: "Catering", slug: "catering", icon: "utensils" },
  { name: "Entertainment", slug: "entertainment", icon: "music" },
  { name: "Emcees", slug: "emcees", icon: "mic" },
  { name: "Car rental", slug: "car-rental", icon: "car" },
  { name: "Florals & decor", slug: "florals-decor", icon: "flower" },
  { name: "Salon & makeup", slug: "salon-makeup", icon: "sparkles" },
  { name: "Spa", slug: "spa", icon: "leaf" },
  { name: "Tailoring", slug: "tailoring", icon: "scissors" },
  { name: "Suit & gown rental", slug: "suit-gown-rental", icon: "shirt" },
];

const WEDDING_SERVICES = [
  "photography",
  "catering",
  "florals-decor",
  "salon-makeup",
  "emcees",
  "car-rental",
  "suit-gown-rental",
];

const EVENT_TYPES = [
  {
    name: "Wedding",
    slug: "wedding",
    defaultCategorySlugs: WEDDING_SERVICES,
    subFunctions: [
      "Engagement",
      "Bridal shower",
      "Sangeet",
      "Haldi",
      "Ceremony",
      "Reception",
      "Other",
    ],
    questions: [
      {
        key: "venueBooked",
        label: "Is the venue already booked?",
        type: "yes_no" as const,
        required: true,
      },
    ],
  },
  {
    name: "Birthday",
    slug: "birthday",
    defaultCategorySlugs: ["catering", "entertainment", "florals-decor", "photography"],
    subFunctions: [],
    questions: [
      { key: "whose", label: "Whose birthday is it?", type: "text" as const, required: true },
      {
        key: "ageGroup",
        label: "Age group",
        type: "single_choice" as const,
        options: ["Kids", "Teen", "Adult"],
        required: true,
      },
      { key: "theme", label: "Theme (optional)", type: "text" as const, required: false },
    ],
  },
  {
    name: "Engagement",
    slug: "engagement",
    defaultCategorySlugs: ["photography", "catering", "florals-decor", "salon-makeup"],
    subFunctions: [],
    questions: [],
  },
  {
    name: "Baby shower",
    slug: "baby-shower",
    defaultCategorySlugs: ["catering", "florals-decor", "photography"],
    subFunctions: [],
    questions: [],
  },
  {
    name: "Anniversary",
    slug: "anniversary",
    defaultCategorySlugs: ["catering", "photography", "entertainment"],
    subFunctions: [],
    questions: [],
  },
  {
    name: "Corporate",
    slug: "corporate",
    defaultCategorySlugs: ["event-planners", "catering", "emcees", "photography"],
    subFunctions: [],
    questions: [
      {
        key: "format",
        label: "Format",
        type: "single_choice" as const,
        options: ["Party", "Conference", "Launch", "Other"],
        required: true,
      },
      {
        key: "setting",
        label: "Indoor or outdoor?",
        type: "single_choice" as const,
        options: ["Indoor", "Outdoor"],
        required: true,
      },
    ],
  },
  {
    name: "Other",
    slug: "other",
    defaultCategorySlugs: [],
    subFunctions: [],
    questions: [],
  },
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let categoriesAdded = 0;
    for (const [order, category] of CATEGORIES.entries()) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", category.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("categories", { ...category, order, active: true });
        categoriesAdded++;
      }
    }

    let eventTypesAdded = 0;
    for (const [order, eventType] of EVENT_TYPES.entries()) {
      const existing = await ctx.db
        .query("eventTypes")
        .withIndex("by_slug", (q) => q.eq("slug", eventType.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("eventTypes", { ...eventType, order, active: true });
        eventTypesAdded++;
      }
    }

    return { categoriesAdded, eventTypesAdded };
  },
});
