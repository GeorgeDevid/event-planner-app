import { v, type Infer } from "convex/values";

export const userRole = v.union(
  v.literal("client"),
  v.literal("vendor"),
  v.literal("admin"),
);
export type UserRole = Infer<typeof userRole>;

export const adminRole = v.union(
  v.literal("super_admin"),
  v.literal("admin"),
  v.literal("moderator"),
  v.literal("support"),
);
export type AdminRole = Infer<typeof adminRole>;

export const userStatus = v.union(v.literal("active"), v.literal("suspended"));

export const vendorStatus = v.union(
  // Setting up the business; not yet sent for review.
  v.literal("draft"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
  v.literal("deactivated"),
);
export type VendorStatus = Infer<typeof vendorStatus>;

export const questionType = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("date"),
  v.literal("single_choice"),
  v.literal("multi_choice"),
  v.literal("yes_no"),
);

export const priceType = v.union(v.literal("fixed"), v.literal("starting_from"));
export const priceUnit = v.union(
  v.literal("per_event"),
  v.literal("per_hour"),
  v.literal("per_person"),
  v.literal("per_item"),
);

export const eventStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("cancelled"),
);

export const inquiryStatus = v.union(
  v.literal("sent"),
  v.literal("quoted"),
  v.literal("declined"),
  v.literal("closed"),
);

export const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("completed"),
);
