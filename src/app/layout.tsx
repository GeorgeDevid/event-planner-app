import type { Metadata } from "next";
import { Suspense } from "react";
import { ConvexAuthNextjsServerProvider } from "@/lib/convex-auth";
import { cormorant, jakarta } from "@/lib/fonts";
import { FullPageLoader } from "@/components/ui/loader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Event Planner – every celebration, beautifully planned",
    template: "%s · Event Planner",
  },
  description:
    "Find and book event planners, photographers, caterers, entertainers, emcees, car rentals, florists, salons, spas, tailors and suit and gown rentals across the Greater Toronto Area.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream text-ink">
        {/* The provider reads the session cookie, so it renders at request time. */}
        <Suspense fallback={<FullPageLoader />}>
          <ConvexAuthNextjsServerProvider>{children}</ConvexAuthNextjsServerProvider>
        </Suspense>
      </body>
    </html>
  );
}
