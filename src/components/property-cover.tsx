"use client";
import { useState } from "react";
import { House } from "lucide-react";
export function PropertyCover({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  let trusted = false;
  try { trusted = !!src && new URL(src).protocol === "https:" && new URL(src).hostname === "ik.imagekit.io" && !new URL(src).username && !new URL(src).password; } catch {}
  return trusted && !failed ? (
    // ImageKit serves optimized images; preserve the external CDN URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="property-cover" src={src!} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  ) : (
    <div className="architecture-lines" aria-label="Fotografia não disponível">
      <House strokeWidth={0.65} size={82} />
      <span className="no-photo">Fotografia não disponível</span>
    </div>
  );
}
