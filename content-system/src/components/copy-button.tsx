"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

export function CopyButton({ text, label = "Copy caption" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the text is on screen to select by hand.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
