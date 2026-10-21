"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { MapPin, ArrowUpRight } from "lucide-react";
import { formatDistance, mapsUrl, walkingRoute, type Coordinates } from "@/lib/property-location";
import { safeUrl } from "@/lib/presentation";
import { nearbyCategories, nearbyQuery, parseNearby, type NearbyCategory, type NearbyPlace } from "@/lib/nearby";
export function PropertyNeighborhood({ point, location }: { point: Coordinates | null; location: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const pins = useRef<Leaflet.LayerGroup | null>(null);
  const line = useRef<Leaflet.Polyline | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, NearbyPlace[]>());
  const mounted = useRef(true);
  const lastRequest = useRef(0);
  const opening = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selection, setSelection] = useState<string | null>(null);
  const [category, setCategory] = useState<NearbyCategory>("bakery");
  const [radius, setRadius] = useState(500);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  function clearPlaces() {
    pins.current?.clearLayers();
    line.current?.remove();
    setSelection(null);
    setPlaces([]);
    setSearched(false);
    setError("");
  }
  function selectPlace(place: NearbyPlace) {
    if (!map.current || !point || !leaflet.current) return;
    setSelection(place.id);
    line.current?.remove();
    line.current = leaflet.current.polyline([[point.lat, point.lng], [place.point.lat, place.point.lng]], { color: "#a83f2c", weight: 2, dashArray: "6 6" }).addTo(map.current);
    map.current.fitBounds(line.current.getBounds(), { padding: [50, 50], maxZoom: 17, animate: false });
  }
  async function openMap() {
    if (!point || !container.current || opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const L = await import("leaflet");
      if (!mounted.current || !container.current) return;
      leaflet.current = L;
      map.current = L.map(container.current, { scrollWheelZoom: false }).setView([point.lat, point.lng], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).on("tileerror", () => { if (mounted.current) setTileError(true); }).addTo(map.current);
      L.marker([point.lat, point.lng], { icon: L.divIcon({ className: "neighborhood-home-pin", html: "Imóvel", iconSize: [66, 32], iconAnchor: [33, 32] }), title: "Ponto publicado do imóvel", alt: "Ponto publicado do imóvel" }).addTo(map.current);
      pins.current = L.layerGroup().addTo(map.current);
      setReady(true);
      requestAnimationFrame(() => map.current?.invalidateSize());
    } catch {
      map.current?.remove();
      map.current = null;
      setError("Não foi possível abrir o mapa. Tente novamente ou abra o link externo.");
    } finally {
      opening.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function showPlaces(results: NearbyPlace[]) {
    if (!leaflet.current || !map.current || !point) return;
    const L = leaflet.current;
    const bounds = L.latLngBounds([[point.lat, point.lng]]);
    results.forEach((place, index) => {
      const marker = L.marker([place.point.lat, place.point.lng], {
        icon: L.divIcon({ className: "neighborhood-place-pin", html: String(index + 1), iconSize: [32, 32], iconAnchor: [16, 32] }),
        title: `${place.name}, ${formatDistance(place.meters)} em linha reta`, alt: place.name,
      }).on("click", () => selectPlace(place));
      const label = document.createElement("span");
      label.textContent = place.name; // External names never become HTML.
      marker.bindTooltip(label);
      pins.current?.addLayer(marker);
      bounds.extend([place.point.lat, place.point.lng]);
    });
    if (results.length) map.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 16, animate: false });
    setPlaces(results);
    setSearched(true);
  }
  async function search() {
    if (!point || !map.current || busy || opening.current) return;
    const cacheKey = `${category}:${radius}`;
    clearPlaces();
    const previous = cache.current.get(cacheKey);
    if (previous) { showPlaces(previous); return; }
    if (Date.now() - lastRequest.current < 5000) {
      setError("Aguarde alguns segundos antes de fazer outra consulta.");
      return;
    }
    opening.current = true;
    lastRequest.current = Date.now();
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current?.abort(), 20000);
    setBusy(true);
    try {
      const endpoint = safeUrl(process.env.NEXT_PUBLIC_OVERPASS_API_URL || "https://overpass.private.coffee/api/interpreter");
      if (!endpoint) throw new Error("invalid_provider");
      const response = await fetch(endpoint, {
        method: "POST", body: new URLSearchParams({ data: nearbyQuery(point, category, radius) }),
        signal: abort.current.signal, credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin",
      });
      if (!response.ok) throw new Error(response.status === 429 ? "rate_limited" : "nearby_unavailable");
      const results = parseNearby(await response.json(), point, category, radius);
      if (!mounted.current) return;
      cache.current.set(cacheKey, results);
      showPlaces(results);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.message === "rate_limited" ? "O serviço está ocupado. Aguarde um pouco antes de tentar novamente." : "Não foi possível consultar os arredores. Você pode tentar novamente em instantes.");
    } finally {
      clearTimeout(timer);
      opening.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section id="localizacao" className="detail-section detail-anchor neighborhood" aria-labelledby="location-title">
      <span className="eyebrow">O LUGAR E SEU ENTORNO</span>
      <h2 id="location-title">Como é a vida por aqui?</h2>
      <p><MapPin size={18} /> {location || "Localização não informada"}</p>
      {!point ? <p>A fonte não publicou coordenadas para este imóvel. Consulte o endereço e a localização com o anunciante.</p> : <>
        <p>O mapa utiliza o ponto publicado pelo anunciante, que pode ser aproximado. Confirme a posição exata antes de visitar.</p>
        <a className="text-link" href={mapsUrl(point)} target="_blank" rel="noopener noreferrer">Abrir localização no Google Maps <ArrowUpRight size={16} /></a>
        <div ref={container} className={`neighborhood-map ${ready ? "is-ready" : ""}`} aria-label="Mapa do imóvel e locais próximos" />
        {!ready && <div className="neighborhood-consent"><MapPin size={30} /><h3>Conheça a região no mapa</h3><p>Ao carregar, seu navegador se conecta ao OpenStreetMap. A busca de estabelecimentos só acontece quando você solicitar.</p><button className="button primary" onClick={openMap} disabled={busy}>{busy ? "Carregando mapa…" : "Carregar mapa e explorar"}</button></div>}
        {tileError && <p role="status">Algumas partes do mapa não carregaram. A lista de locais e o link externo continuam disponíveis.</p>}
        {ready && <>
          <form className="neighborhood-controls" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <label>O que você quer ter por perto?<select value={category} disabled={busy} onChange={(e) => { clearPlaces(); setCategory(e.target.value as NearbyCategory); }}>{Object.entries(nearbyCategories).map(([value, c]) => <option key={value} value={value}>{c.label}</option>)}</select></label>
            <label>Raio de busca<select value={radius} disabled={busy} onChange={(e) => { clearPlaces(); setRadius(Number(e.target.value)); }}><option value={500}>500 m</option><option value={1000}>1 km</option></select></label>
            <button className="button primary" disabled={busy}>{busy ? "Consultando…" : "Explorar arredores"}</button>
          </form>
          <p className="neighborhood-note">Distâncias aproximadas em linha reta a partir do ponto publicado; não são percursos a pé. A linha no mapa conecta os pontos e não representa uma rota. Até 12 locais, dentre os registros retornados pelo OpenStreetMap; a cobertura pode ser incompleta.</p>
          <p role="status" aria-live="polite">{busy ? "Consultando locais próximos…" : searched ? places.length ? `${places.length} locais exibidos nesta consulta.` : "Nenhum local retornado nesta consulta. Isso não significa que não existam estabelecimentos na região." : "Escolha uma categoria para explorar."}</p>
          <ol className="neighborhood-places">{places.map((place, i) => <li key={place.id} className={selection === place.id ? "is-selected" : ""}>
            <button className="neighborhood-select" onClick={() => selectPlace(place)} aria-pressed={selection === place.id}><span className="neighborhood-number">{i + 1}</span><span><strong>{place.name}</strong><small>{formatDistance(place.meters)} em linha reta</small></span></button>
            <div className="neighborhood-links"><a href={walkingRoute(point, place.point)} target="_blank" rel="noopener noreferrer">Traçar rota a pé no Google ↗</a><a href={place.url} target="_blank" rel="noopener noreferrer">Ver no OpenStreetMap ↗</a></div>
          </li>)}</ol>
          <p className="neighborhood-credit">Dados © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Informar problema no mapa</a>. Os cadastros podem mudar; confirme diretamente com o local.</p>
        </>}
        {error && <p role="alert">{error}</p>}
      </>}
    </section>
  );
}
