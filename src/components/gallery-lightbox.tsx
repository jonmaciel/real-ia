"use client";
import { useMemo, type KeyboardEvent } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { type GalleryPhoto, photoLabel } from "@/lib/gallery";
function containFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const root = event.currentTarget;
  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (node) => node.getClientRects().length > 0 && !node.closest("[inert]"),
  );
  const active = document.activeElement;
  const first = buttons[0],
    last = buttons[buttons.length - 1];
  if (
    first &&
    last &&
    ((event.shiftKey &&
      (active === first || !buttons.includes(active as HTMLElement))) ||
      (!event.shiftKey && active === last))
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
export default function GalleryLightbox({
  photos,
  title,
  index,
  onClose,
  onView,
}: {
  photos: GalleryPhoto[];
  title: string;
  index: number;
  onClose: () => void;
  onView: (index: number) => void;
}) {
  const slides = useMemo(
    () =>
      photos.map((p, i) => ({
        src: p.src,
        width: p.width,
        height: p.height,
        alt: `${photoLabel(p, i)} — ${title}`,
        description: `${photoLabel(p, i)}${p.attribution ? ` · ${p.attribution}` : ""}`,
      })),
    [photos, title],
  );
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom, Captions, Counter, Fullscreen]}
      carousel={{
        finite: true,
        preload: 1,
        imageFit: "contain",
        imageProps: { referrerPolicy: "no-referrer" },
      }}
      controller={{ closeOnBackdropClick: true }}
      portal={{ container: { onKeyDown: containFocus } }}
      on={{ view: ({ index }) => onView(index) }}
      labels={{
        Close: "Fechar imagem",
        Next: "Próxima imagem",
        Previous: "Imagem anterior",
        "Zoom in": "Ampliar imagem",
        "Zoom out": "Reduzir imagem",
        "Enter Fullscreen": "Ativar tela cheia",
        "Exit Fullscreen": "Sair da tela cheia",
        Lightbox: "Imagem em tela cheia",
        Carousel: "carrossel",
        Slide: "imagem",
        "Photo gallery": "Imagens do imóvel",
        "{index} of {total}": "{index} de {total}",
      }}
      render={{
        iconError: () => (
          <p role="status">Não foi possível carregar esta imagem.</p>
        ),
      }}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 2, doubleClickMaxStops: 1 }}
      captions={{ descriptionMaxLines: 3 }}
    />
  );
}
