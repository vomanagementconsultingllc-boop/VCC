"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Download every clip for a job. Each file gets its own fresh signed link;
 * they are started one after another so the browser treats them as separate
 * downloads (it may ask once for permission to download several files).
 */
export function DownloadAll({ urls }: { urls: string[] }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function run() {
    setState("running");
    for (const url of urls) {
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = url;
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 120_000);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    setState("done");
  }

  return (
    <Button type="button" onClick={run} disabled={state === "running" || urls.length === 0}>
      {state === "running" ? "Starting downloads…" : state === "done" ? "Download all again" : `Download all (${urls.length})`}
    </Button>
  );
}
