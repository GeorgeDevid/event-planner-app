"use client";

import { useMutation } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, LinkButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Card, PageHeader, PhotoPlaceholder, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { useMyVendor, type MyVendor } from "@/components/vendor/use-vendor";
import { errorMessage } from "@/lib/errors";
import { checkFile, IMAGE_ACCEPT, uploadToConvex } from "@/lib/upload";

/** V-03: cover, logo, about and portfolio. */
export default function VendorProfile() {
  const vendor = useMyVendor();
  if (vendor === undefined) return <FullPageLoader />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profile & portfolio"
        backHref="/vendor"
        action={
          <LinkButton href="/vendor/preview" variant="secondary" className="px-4">
            Preview
          </LinkButton>
        }
      />
      <BrandImages vendor={vendor} />
      <AboutForm vendor={vendor} />
      <Portfolio vendor={vendor} />
      <Card className="flex flex-col">
        <h2 className="mb-2 text-[17px] font-bold">Business information</h2>
        {[
          { label: "Business details", value: `${vendor.companyName} · ${vendor.ownerName}` },
          { label: "Services", value: vendor.categories.map((c) => c.name).join(", ") || "None chosen" },
          { label: "Location", value: vendor.address ?? "Not set" },
          { label: "Packages", value: `${vendor.packages.length} packages`, href: "/vendor/packages" },
        ].map((row) => (
          <Link
            key={row.label}
            href={row.href ?? "/vendor/setup"}
            className="flex min-h-14 items-center gap-3 border-t border-line py-2 first-of-type:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink-2">{row.label}</span>
              <span className="block truncate text-sm">{row.value}</span>
            </span>
            <span className="text-sm font-semibold text-gold-text">Edit</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}

function useUploader() {
  const generateUploadUrl = useMutation(api.vendors.generateUploadUrl);
  return (file: File) => uploadToConvex(generateUploadUrl, file);
}

function BrandImages({ vendor }: { vendor: MyVendor }) {
  const setBrandImage = useMutation(api.vendors.setBrandImage);
  const upload = useUploader();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"cover" | "logo" | null>(null);

  async function change(kind: "cover" | "logo", file: File | undefined) {
    if (!file) return;
    setError(null);
    const problem = checkFile(file, "image");
    if (problem) return setError(problem);
    setBusy(kind);
    try {
      await setBrandImage({ kind, storageId: await upload(file) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Cover photo and logo" className="flex flex-col gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="relative">
        {vendor.coverUrl ? (
          <Image
            src={vendor.coverUrl}
            alt="Cover photo"
            width={780}
            height={360}
            className="h-44 w-full rounded-[24px] object-cover"
          />
        ) : (
          <PhotoPlaceholder label="Cover photo" className="h-44 w-full rounded-[24px]" />
        )}
        <FileButton
          label={busy === "cover" ? "Uploading…" : vendor.coverUrl ? "Change cover" : "Add cover"}
          onFile={(f) => change("cover", f)}
          className="absolute top-3 right-3"
        />
        <div className="absolute -bottom-8 left-4 size-20 overflow-hidden rounded-full border-4 border-cream bg-gold-300">
          {vendor.logoUrl ? (
            <Image src={vendor.logoUrl} alt="Logo" width={80} height={80} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-xl font-bold text-navy-900">
              {vendor.companyName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <FileButton
          label={busy === "logo" ? "Uploading…" : vendor.logoUrl ? "Change logo" : "Add logo"}
          onFile={(f) => change("logo", f)}
        />
      </div>
    </section>
  );
}

function FileButton({
  label,
  onFile,
  className = "",
}: {
  label: string;
  onFile: (file: File | undefined) => void;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-full bg-surface px-4 text-sm font-semibold text-navy-900 shadow-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${className}`}
    >
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {label}
    </label>
  );
}

function AboutForm({ vendor }: { vendor: MyVendor }) {
  const updateAbout = useMutation(api.vendors.updateAbout);
  const [about, setAbout] = useState(vendor.about ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = about !== (vendor.about ?? "");

  return (
    <Card className="mt-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setState("saving");
          try {
            await updateAbout({ about });
            setState("saved");
          } catch (err) {
            setError(errorMessage(err));
            setState("idle");
          }
        }}
      >
        <TextArea
          id="about"
          label="About your business"
          maxLength={2000}
          value={about}
          error={error}
          helper="What makes your work special, what's included, the areas you serve."
          onChange={(e) => {
            setAbout(e.target.value);
            setState("idle");
          }}
        />
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-ink-2" aria-live="polite">
            {state === "saved" && !dirty ? "Saved" : ""}
          </span>
          <Button type="submit" disabled={!dirty || state === "saving"}>
            {state === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Portfolio({ vendor }: { vendor: MyVendor }) {
  const addImages = useMutation(api.vendors.addPortfolioImages);
  const removeImage = useMutation(api.vendors.removePortfolioImage);
  const moveImage = useMutation(api.vendors.movePortfolioImage);
  const upload = useUploader();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const room = vendor.maxPortfolio - vendor.images.length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    if (list.length > room) {
      setError(`You have room for ${room} more photo${room === 1 ? "" : "s"}.`);
      return;
    }
    const problems = list.map((f) => checkFile(f, "image")).filter(Boolean);
    if (problems.length) {
      setError(problems.join(" "));
      return;
    }
    try {
      const ids: Id<"_storage">[] = [];
      for (const [i, file] of list.entries()) {
        setUploading(`Uploading ${i + 1} of ${list.length}…`);
        ids.push(await upload(file));
      }
      await addImages({ storageIds: ids });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold">Portfolio</h2>
        <span className="text-sm text-ink-2">
          {vendor.images.length} of {vendor.maxPortfolio} photos
        </span>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {vendor.images.length > 0 ? (
        <ol className="grid grid-cols-3 gap-2">
          {vendor.images.map((img, i) => (
            <li key={img._id} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
              {img.url ? (
                <Image src={img.url} alt={`Portfolio photo ${i + 1}`} fill sizes="(max-width: 448px) 33vw, 140px" className="object-cover" />
              ) : null}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <span className="flex gap-1">
                  <IconButton label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => moveImage({ imageId: img._id, direction: "up" })} path="M15 6l-6 6 6 6" />
                  <IconButton label={`Move photo ${i + 1} later`} disabled={i === vendor.images.length - 1} onClick={() => moveImage({ imageId: img._id, direction: "down" })} path="M9 6l6 6-6 6" />
                </span>
                <IconButton label={`Delete photo ${i + 1}`} onClick={() => removeImage({ imageId: img._id })} path="M6 6l12 12M18 6L6 18" />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-2">
          Add your best work. Clients look at photos first when choosing a vendor.
        </p>
      )}
      {room > 0 ? (
        <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-dashed border-control px-4 py-4 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text">
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            disabled={uploading !== null}
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <span className="text-[15px] font-semibold" aria-live="polite">
            {uploading ?? "Add photos"}
          </span>
          <span className="text-[13px] text-ink-2">JPG, PNG or WebP, up to 5 MB each</span>
        </label>
      ) : null}
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  path,
  disabled,
}: {
  label: string;
  onClick: () => void;
  path: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex size-11 items-center justify-center rounded-full bg-navy-900/70 text-white disabled:opacity-30"
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </button>
  );
}
