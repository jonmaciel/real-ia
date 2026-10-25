import { ImageResponse } from "next/og";
import type { Listing } from "./contracts";
import { listingShareData, shareImageSize, shortText, siteOrigin } from "./seo";
import { previewPhoto } from "./share-photo";

const ink = "#20252b", orange = "#c4470a", cream = "#fff7f1";
function HouseMark({ size = 56 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill={orange}/><path d="M15 29 32 15l17 14v21H37V36H27v14H15V29Z" fill="none" stroke="white" strokeWidth="3.8" strokeLinejoin="round"/></svg>;
}
function Brand() {
  return <div style={{ display: "flex", alignItems: "center", gap: 14 }}><HouseMark/><div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -2 }}>morada<span style={{ color: orange }}>.</span></div></div>;
}
function Architecture() {
  return <svg width="430" height="510" viewBox="0 0 430 510"><circle cx="245" cy="220" r="185" fill="#f5dcca"/><circle cx="326" cy="122" r="49" fill="#e9b48c"/><path d="M55 400V191L206 102l150 89v209" fill="#e7b38c"/><path d="M55 400V191l151-89v298" fill="#fffaf4"/><path d="M205 400V225c0-43 72-43 72 0v175" fill="#c4470a"/><path d="M99 284v-51c0-42 64-42 64 0v51Z" fill="#56715c"/><path d="M112 284v-48c0-26 39-26 39 0v48" fill="#b9cbb4"/><path d="M309 289v-61h27v61" fill="#9f6747"/><path d="M31 400h350" stroke="#b18e75" strokeWidth="4" strokeLinecap="round"/><path d="M322 400v-76m0 27c-43-3-58-27-51-52 35 1 58 21 51 52Zm0-1c40-10 54-37 42-59-31 7-50 28-42 59Z" fill="#56715c" stroke="#56715c" strokeWidth="4"/><path d="M304 400h35l8-47h-51Z" fill="#bc693e"/><path d="M83 431h236" stroke="#e9d6c5" strokeWidth="4" strokeLinecap="round"/></svg>;
}
export function brandShareImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: cream, color: ink, padding: "52px 60px", position: "relative" }}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: orange }}/>
    <div style={{ display: "flex", width: 650, flexDirection: "column", justifyContent: "space-between" }}>
      <Brand/>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ color: orange, fontSize: 17, fontWeight: 700, letterSpacing: 3 }}>COMPRAR · ALUGAR · DESCOBRIR</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 70, lineHeight: 1.05, letterSpacing: -3, fontWeight: 700 }}><span>Seu próximo lugar.</span><span style={{ color: orange }}>Seu novo começo.</span></div>
        <div style={{ fontSize: 25, color: "#606973", maxWidth: 590, lineHeight: 1.4 }}>Encontre imóveis com IA, explore fotos e veja as informações que importam.</div>
      </div>
      <div style={{ fontSize: 20, color: "#606973" }}>{new URL(siteOrigin()).hostname}</div>
    </div>
    <div style={{ display: "flex", position: "absolute", right: 25, bottom: 30 }}><Architecture/></div>
  </div>, { ...shareImageSize });
}
export async function propertyShareImage(p: Listing, loadPhoto = previewPhoto) {
  const data = listingShareData(p);
  const photo = await loadPhoto(p.cover_url);
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: cream, color: ink }}>
    <div style={{ display: "flex", width: 660, height: 630, position: "relative", background: "#f2e4d7", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* The image is downloaded and normalized within strict limits before reaching the renderer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} width="660" height="630" alt="" style={{ objectFit: "cover", width: "100%", height: "100%" }}/> : <Architecture/>}
      <div style={{ display: "flex", position: "absolute", top: 34, left: 34, padding: "13px 21px", background: "white", borderRadius: 30, color: ink, fontWeight: 700, fontSize: 18 }}>{p.listing_type === "rental" ? "PARA ALUGAR" : p.listing_type === "sale" ? "À VENDA" : "CONHEÇA O IMÓVEL"}</div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "absolute", left: 0, right: 0, bottom: 0, height: 230, padding: "34px", background: "linear-gradient(0deg, rgba(12,20,18,0.94), rgba(12,20,18,0))", color: "white", gap: 14 }}>
        <div style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.25 }}>{data.location}</div>
        {data.highlights.length > 0 && <div style={{ fontSize: 21 }}>{data.highlights.join(" · ")}</div>}
        {!photo && <div style={{ fontSize: 16 }}>Foto do imóvel não disponível</div>}
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 540, padding: "38px 40px 32px" }}>
      <Brand/>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 37, fontWeight: 700, letterSpacing: -1.1, lineHeight: 1.2 }}>{shortText(p.title, 98)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 16, color: "#72706c", letterSpacing: 1.5 }}>PREÇO ANUNCIADO</div>
          <div style={{ color: orange, fontSize: data.price.length > 19 ? 34 : 48, fontWeight: 700, letterSpacing: -1.5 }}>{data.price}</div>
          {data.pricePeriod && <div style={{ fontSize: 23, color: "#606973" }}>{data.pricePeriod.replace(/^\//, "por ")}</div>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #e7d9ce", paddingTop: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Fotos, detalhes e anúncio original ↗</div>
        <div style={{ fontSize: 17, color: "#606973" }}>{new URL(siteOrigin()).hostname}</div>
      </div>
    </div>
  </div>, { ...shareImageSize });
}
