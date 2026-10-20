"use client";
import { useState } from "react";
export function MediaImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="image-fallback" role="status">
      Não foi possível exibir esta imagem.{" "}
      <a href={src} target="_blank" rel="noopener noreferrer">
        Abrir na origem
      </a>
    </div>
  ) : (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </a>
  );
}
