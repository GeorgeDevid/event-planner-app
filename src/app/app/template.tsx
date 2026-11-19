import type { ReactNode } from "react";

/** Re-mounts on each navigation, so the new page's content eases in (see `page-in`). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-in">{children}</div>;
}
