"use client";
import { useState } from "react";
import { PropertyCover } from "./property-cover";
type Photo = { id: string | number; hosted_url?: string | null; is_cover?: boolean; position?: number; processing_status: string };
export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const ready = photos.filter((photo) => {
    try { return photo.processing_status === "completed" && !!photo.hosted_url && new URL(photo.hosted_url).protocol === "https:" && new URL(photo.hosted_url).hostname === "ik.imagekit.io"; } catch { return false; }
  }).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const primary = ready.find((photo) => photo.is_cover) ?? ready[0];
  const [selected, setSelected] = useState<string | number | undefined>(undefined);
  const active = ready.find((photo) => photo.id === selected) ?? primary;
  if (!active) return <div className="review-placeholder"><PropertyCover alt={title} /></div>;
  return (
    <section className="photo-gallery" aria-label="Fotos do anúncio">
      <div className="review-placeholder gallery-viewer">
        <PropertyCover key={active.hosted_url} src={active.hosted_url} alt={`${active.is_cover ? "Capa" : "Foto do imóvel"} — ${title}`} />
      </div>
      <p className="gallery-caption">{active.is_cover ? "Capa · " : ""}{ready.findIndex((photo) => photo.id === active.id) + 1} de {ready.length} fotos disponíveis{photos.length > ready.length ? ` · ${photos.length - ready.length} aguardando processamento` : ""}</p>
      <div className="gallery-thumbnails">
        {ready.map((photo, index) => <button key={photo.id} type="button" aria-label={`Ver foto ${index + 1}${photo.is_cover ? " — capa" : ""}`} aria-pressed={photo.id === active.id} onClick={() => setSelected(photo.id)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.hosted_url!} alt="" loading="lazy" referrerPolicy="no-referrer" />
          {photo.is_cover && <span>Capa</span>}
        </button>)}
      </div>
    </section>
  );
}
