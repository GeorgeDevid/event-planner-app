import { Card, PageHeader } from "@/components/ui/kit";

export default function VendorInquiries() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inquiries" backHref="/vendor" />
      <Card>
        <p className="text-sm text-ink-2">
          Client inquiries and quotes arrive in a later build step. Once your business is approved,
          new inquiries will appear here.
        </p>
      </Card>
    </div>
  );
}
