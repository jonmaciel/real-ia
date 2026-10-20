import { ImageResponse } from "next/og";
export const alt = "Morada — Encontre um lugar que combine com você.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#e9eee5",
        color: "#254d40",
        padding: 80,
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 700 }}>morada.</div>
      <div style={{ fontSize: 64, maxWidth: 900, lineHeight: 1.2 }}>
        Encontre um lugar que combine com você.
      </div>
      <div style={{ fontSize: 22 }}>
        Novas possibilidades. Escolhas mais claras.
      </div>
    </div>,
    size,
  );
}
