"use client";
import { useState, useCallback } from "react";
import { ImageOff } from "lucide-react";
import type { GalleryPhoto } from "@/lib/gallery";
export function GalleryImage({
  photo,
  alt,
  eager = false,
}: {
  photo: GalleryPhoto;
  alt: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);
  return failed ? (
    <span className="gallery-broken">
      <ImageOff aria-hidden="true" size={28} />
      <span>Imagem indisponível</span>
    </span>
  ) : (
    // Imagem autorizada carregada diretamente, sem proxy aberto de otimização.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={photo.src}
      alt={alt}
      width={photo.width ?? 1000}
      height={photo.height ?? 680}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
