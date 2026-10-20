"use client";
import { useEffect, useRef, useId } from "react";
import { ArrowLeft, Expand } from "lucide-react";
import { type GalleryPhoto, photoLabel } from "@/lib/gallery";
import { GalleryImage } from "./gallery-image";
export default function PhotoAlbum({
  photos,
  title,
  active,
  filter,
  onFilter,
  onClose,
  onSelect,
}: {
  photos: GalleryPhoto[];
  title: string;
  active: number;
  filter: string;
  onFilter: (value: string) => void;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    if (active > 0)
      node
        .querySelector<HTMLButtonElement>(`[data-photo-index="${active}"]`)
        ?.focus({ preventScroll: false });
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [active]);
  const hasPlans = photos.some((p) => p.kind === "floor_plan");
  return (
    <dialog
      ref={dialog}
      className="photo-album"
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="album-header">
        <button className="button secondary" onClick={onClose} autoFocus>
          <ArrowLeft size={18} />
          Voltar ao imóvel
        </button>
        <span className="album-total">{photos.length} imagens</span>
      </header>
      <div className="album-content">
        <span className="eyebrow">CADA DETALHE, NO SEU TEMPO</span>
        <h2 id={heading}>Conheça este lugar por inteiro.</h2>
        <p>{title}</p>
        {hasPlans && (
          <div
            className="album-filters"
            role="group"
            aria-label="Tipo de imagem"
          >
            {[
              ["all", "Todas"],
              ["image", "Fotos"],
              ["floor_plan", "Plantas"],
            ].map(([key, label]) => (
              <button
                key={key}
                className="button secondary"
                aria-pressed={filter === key}
                onClick={() => onFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="album-grid">
          {photos.map((photo, index) =>
            filter === "all" || filter === photo.kind ? (
              <figure key={photo.id}>
                <button
                  data-photo-index={index}
                  onClick={() => onSelect(index)}
                  aria-label={`Ampliar ${photoLabel(photo, index).toLowerCase()}`}
                >
                  <GalleryImage
                    photo={photo}
                    alt={`${photoLabel(photo, index)} — ${title}`}
                  />
                  <span className="album-expand">
                    <Expand size={18} />
                  </span>
                </button>
                <figcaption>
                  <span>{photoLabel(photo, index)}</span>
                  {photo.attribution && <span>{photo.attribution}</span>}
                </figcaption>
              </figure>
            ) : null,
          )}
        </div>
        <p className="album-note">
          Explore sem pressa. Toque em uma imagem para ampliar e ver os
          detalhes.
        </p>
      </div>
    </dialog>
  );
}
