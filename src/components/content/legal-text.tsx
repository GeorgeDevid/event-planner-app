import type { ReactNode } from "react";

/**
 * Renders plain-text documents written in the admin editor: "## " starts a
 * heading, "- " a bullet, a blank line a new paragraph. No HTML is accepted,
 * so nothing typed in the editor can run as code.
 */
export function LegalText({ body }: { body: string }) {
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((block, i) => {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return;
    if (lines.every((l) => l.trim().startsWith("- "))) {
      out.push(
        <ul key={i} className="ml-5 list-disc space-y-1">
          {lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}
        </ul>,
      );
      return;
    }
    lines.forEach((l, j) => {
      const t = l.trim();
      if (t.startsWith("## ")) out.push(<h2 key={`${i}-${j}`} className="mt-4 text-[18px] font-bold">{t.slice(3)}</h2>);
      else if (t.startsWith("# ")) out.push(<h2 key={`${i}-${j}`} className="mt-4 text-[22px] font-bold">{t.slice(2)}</h2>);
      else out.push(<p key={`${i}-${j}`}>{t}</p>);
    });
  });
  return <div className="flex flex-col gap-3 text-[15px] leading-relaxed">{out}</div>;
}
