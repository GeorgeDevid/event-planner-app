import { NotificationList } from "@/components/messaging/notifications";
import { PageHeader } from "@/components/ui/kit";

export default function ClientNotifications() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" backHref="/app" />
      <NotificationList />
    </div>
  );
}
