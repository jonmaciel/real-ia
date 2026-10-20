"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Grid2X2,
  House,
  ArrowUpRight,
} from "lucide-react";
import { photoLabel, type GalleryPhoto } from "@/lib/gallery";
import { GalleryImage } from "./gallery-image";
const PhotoAlbum = dynamic(() => import("./photo-album"), {
  ssr: false,
  loading: () => <p role="status">Abrindo álbum…</p>,
});
const GalleryLightbox = dynamic(() => import("./gallery-lightbox"), {
  ssr: false,
  loading: () => <p role="status">Abrindo imagem…</p>,
});
type Attachment = {
  id: string;
  url: string;
  label: string;
  attribution?: string | null;
};
export function PropertyGallery({
  photos,
  attachments,
  title,
  failed = false,
}: {
  photos: GalleryPhoto[];
  attachments: Attachment[];
  title: string;
  failed?: boolean;
}) {
  const [ref, api] = useEmblaCarousel({
    loop: false,
    align: "start",
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  });
  const [current, setCurrent] = useState(0);
  const [album, setAlbum] = useState(false);
  const [albumFilter, setAlbumFilter] = useState("all");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const returnAlbum = useRef(false);
  const showAll = useRef<HTMLButtonElement>(null);
  const photoButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const sync = useCallback(() => {
    if (api) setCurrent(api.selectedScrollSnap());
  }, [api]);
  useEffect(() => {
    if (!api) return;
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api, sync]);
  function view(index: number) {
    api?.scrollTo(index, true);
    setCurrent(index);
  }
  function open(index: number, fromAlbum = false) {
    returnAlbum.current = fromAlbum;
    setAlbum(false);
    setLightbox(index);
  }
  function closeLightbox() {
    setLightbox(null);
    if (returnAlbum.current) setAlbum(true);
    else
      requestAnimationFrame(() =>
        photoButtons.current[current]?.focus({ preventScroll: true }),
      );
  }
  function closeAlbum() {
    setAlbum(false);
    requestAnimationFrame(() =>
      showAll.current?.focus({ preventScroll: true }),
    );
  }
  return (
    <section className="property-gallery" aria-label="Mídias do imóvel">
      {photos.length ? (
        <>
          <div
            className="property-carousel"
            role="region"
            aria-roledescription="carrossel"
            aria-label="Imagens do imóvel"
            onKeyDown={(e) => {
              const targets: Record<string, number> = {
                ArrowRight: Math.min(current + 1, photos.length - 1),
                ArrowLeft: Math.max(current - 1, 0),
                Home: 0,
                End: photos.length - 1,
              };
              if (!Object.hasOwn(targets, e.key)) return;
              e.preventDefault();
              const next = targets[e.key];
              api?.scrollTo(next);
              if (photoButtons.current.includes(e.target as HTMLButtonElement))
                requestAnimationFrame(() =>
                  photoButtons.current[next]?.focus({ preventScroll: true }),
                );
            }}
          >
            <div className="property-carousel-viewport" ref={ref}>
              <div className="property-carousel-track">
                {photos.map((photo, index) => (
                  <div
                    className="property-carousel-slide"
                    key={photo.id}
                    aria-hidden={index !== current}
                    role="group"
                    aria-roledescription="imagem"
                    aria-label={`${index + 1} de ${photos.length}`}
                  >
                    <button
                      ref={(node) => {
                        photoButtons.current[index] = node;
                      }}
                      tabIndex={index === current ? 0 : -1}
                      onClick={() => {
                        open(index);
                      }}
                      aria-label={`Ampliar ${photoLabel(photo, index).toLowerCase()}`}
                    >
                      <GalleryImage
                        photo={photo}
                        alt={`${photoLabel(photo, index)} — ${title}`}
                        eager={index === 0}
                      />
                      <span className="gallery-expand">
                        <Expand size={17} />
                        Ampliar
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <span className="gallery-position" aria-hidden="true">
              {String(current + 1).padStart(2, "0")} /{" "}
              {String(photos.length).padStart(2, "0")}
            </span>
            {photos.length > 1 && (
              <div className="carousel-arrows">
                <button
                  aria-label="Imagem anterior"
                  disabled={current === 0}
                  onClick={() => api?.scrollPrev()}
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  aria-label="Próxima imagem"
                  disabled={current === photos.length - 1}
                  onClick={() => api?.scrollNext()}
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="gallery-toolbar">
            <div>
              <p className="gallery-current" role="status" aria-live="polite">
                {photoLabel(photos[current] ?? photos[0], current)} ·{" "}
                {current + 1} de {photos.length}
              </p>
              {photos[current]?.attribution && (
                <p className="gallery-credit">{photos[current].attribution}</p>
              )}
            </div>
            <button
              className="button secondary"
              ref={showAll}
              onClick={() => setAlbum(true)}
            >
              <Grid2X2 size={17} />
              Ver todas ({photos.length})
            </button>
          </div>
          {photos.length > 1 && (
            <div
              className="property-thumbnails"
              role="group"
              aria-label="Selecionar imagem"
            >
              {photos.slice(0, 7).map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => api?.scrollTo(index)}
                  aria-label={`Ver ${photoLabel(photo, index).toLowerCase()}`}
                  aria-pressed={current === index}
                >
                  <GalleryImage photo={photo} alt="" />
                  {photo.kind === "floor_plan" && <span>Planta</span>}
                </button>
              ))}
              {photos.length > 7 && (
                <button className="more-photos" onClick={() => setAlbum(true)}>
                  +{photos.length - 7}
                  <span>Ver álbum</span>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="gallery-empty">
          <House size={90} strokeWidth={0.6} />
          <p>
            {failed
              ? "Não foi possível carregar as mídias."
              : "Nenhuma fotografia disponível."}
          </p>
          <span>Todos os detalhes disponíveis estão abaixo.</span>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="gallery-attachments">
          {attachments.map((a) => (
            <div key={a.id}>
              <a
                className="text-link"
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {a.label} na origem <ArrowUpRight size={15} />
              </a>
              {a.attribution && (
                <p className="gallery-credit">{a.attribution}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {album && (
        <PhotoAlbum
          photos={photos}
          title={title}
          filter={albumFilter}
          onFilter={setAlbumFilter}
          active={current}
          onClose={closeAlbum}
          onSelect={(index) => open(index, true)}
        />
      )}{" "}
      {lightbox !== null && (
        <GalleryLightbox
          photos={photos}
          title={title}
          index={lightbox}
          onClose={closeLightbox}
          onView={view}
        />
      )}
    </section>
  );
}
