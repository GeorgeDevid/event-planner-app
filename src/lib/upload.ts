import type { Id } from "../../convex/_generated/dataModel";

/** Upload one file to Convex storage and return its storage id. */
export async function uploadToConvex(
  generateUploadUrl: () => Promise<string>,
  file: File,
): Promise<Id<"_storage">> {
  const url = await generateUploadUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed. Check your connection and try again.");
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png";
export const MAX_IMAGE_MB = 5;
export const MAX_DOCUMENT_MB = 10;

/** Checks the file before uploading, so people get the error right away. */
export function checkFile(
  file: File,
  kind: "image" | "document",
): string | null {
  const types = (kind === "image" ? IMAGE_ACCEPT : DOCUMENT_ACCEPT).split(",");
  const max = (kind === "image" ? MAX_IMAGE_MB : MAX_DOCUMENT_MB) * 1024 * 1024;
  if (!types.includes(file.type)) {
    return kind === "image"
      ? `${file.name}: use a JPG, PNG or WebP photo.`
      : `${file.name}: use a PDF, JPG or PNG file.`;
  }
  if (file.size > max) {
    return `${file.name} is larger than ${kind === "image" ? MAX_IMAGE_MB : MAX_DOCUMENT_MB} MB.`;
  }
  return null;
}
