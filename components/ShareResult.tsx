"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share menu: native share sheet (mobile), copy link, downloadable image and
 * intent links for messaging/social apps. Links carry the scenario INPUTS, so
 * a reopened link recalculates with the latest data.
 */
export function ShareResult({
  path,
  imagePath,
  text,
  filename,
  label = "Share",
}: {
  path: string;
  imagePath: string;
  text: string;
  filename: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [origin, setOrigin] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const url = origin + path;
  const enc = encodeURIComponent;

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "What If I Invested?", text, url });
    } catch {
      /* user cancelled */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(imagePath);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(imagePath, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const intents: [string, string][] = [
    ["X / Twitter", `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`],
    ["WhatsApp", `https://wa.me/?text=${enc(`${text} ${url}`)}`],
    ["Telegram", `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ["Reddit", `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`],
  ];

  const canNative = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-primary" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3v12M12 3l-4 4M12 3l4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-card rise">
          {canNative && (
            <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2" onClick={nativeShare}>
              Share via…
            </button>
          )}
          <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2" onClick={copy}>
            {copied ? "✓ Link copied" : "Copy link"}
          </button>
          <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2" onClick={download} disabled={downloading}>
            {downloading ? "Preparing image…" : "Download image"}
          </button>
          <div className="my-1 h-px bg-line" />
          <div className="grid grid-cols-2 gap-1">
            {intents.map(([name, href]) => (
              <a key={name} role="menuitem" href={href} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                {name}
              </a>
            ))}
          </div>
          <div aria-live="polite" className="sr-only">
            {copied ? "Link copied to clipboard" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
