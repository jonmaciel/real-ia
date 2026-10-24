"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, ArrowUpRight, Croissant, Pill, ShoppingBasket, BusFront, Store, Layers, LocateFixed, RefreshCw } from "lucide-react";
import { formatDistance, mapsUrl, walkingRoute, type Coordinates } from "@/lib/property-location";
import { nearbyCategories, type NearbyPlace, type NearbySelection } from "@/lib/nearby";
import type { NeighborhoodMap } from "@/lib/neighborhood-map";
const icons = { bakery: Croissant, pharmacy: Pill, supermarket: ShoppingBasket, bus: BusFront, shops: Store };
const provider = process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? "openstreetmap";
export function PropertyNeighborhood({ point, location }: { point: Coordinates | null; location: string }) {
  return <section id="localizacao" className="detail-section detail-anchor neighborhood" aria-labelledby="location-title">
    <span className="eyebrow">O LUGAR E SEU ENTORNO</span>
    <h2 id="location-title">Como é a vida por aqui?</h2>
    <p className="neighborhood-address"><MapPin size={18} aria-hidden="true" /> {location || "Localização não informada"}</p>
    {!point ? <p>A fonte não publicou coordenadas para este imóvel. Consulte o endereço e a localização com o anunciante.</p>
      : <NeighborhoodPanel key={`${point.lat}:${point.lng}:${provider}`} point={point} />}
  </section>;
}
function NeighborhoodPanel({ point }: { point: Coordinates }) {
  const container = useRef<HTMLDivElement>(null);
  const driver = useRef<NeighborhoodMap | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, NearbyPlace[]>());
  const mounted = useRef(false);
  const requesting = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapError, setMapError] = useState("");
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selection, setSelection] = useState<string | null>(null);
  const [category, setCategory] = useState<NearbySelection>("essentials");
  const [radius, setRadius] = useState(500);
  const [searched, setSearched] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const choosePlace = useCallback((place: NearbyPlace) => { setSelection(place.id); driver.current?.select(place); }, []);
  const search = useCallback(async (map: NeighborhoodMap, next: NearbySelection, distance: number) => {
    if (requesting.current) return;
    requesting.current = true; setBusy(true); setError(""); setSelection(null); setSearched(false);
    setPlaces([]); map.setPlaces([], choosePlace);
    const key = `${next}:${distance}`;
    const controller = new AbortController(); abort.current = controller;
    try {
      const cached = provider === "openstreetmap" ? cache.current.get(key) : undefined;
      const results = cached ?? await map.search(next, distance, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
      if (controller.signal.aborted || !mounted.current) return;
      if (provider === "openstreetmap") cache.current.set(key, results);
      map.setPlaces(results, choosePlace); setPlaces(results); setSearched(true);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error && cause.message === "rate_limited" ? "O serviço está ocupado. Aguarde um pouco antes de tentar novamente." : "Não foi possível consultar os arredores. Tente novamente ou consulte o Google Maps.");
    } finally {
      if (abort.current === controller) { requesting.current = false; if (mounted.current) setBusy(false); }
    }
  }, [choosePlace]);
  useEffect(() => {
    mounted.current = true;
    const setup = new AbortController();
    let instance: NeighborhoodMap | null = null;
    let observer: ResizeObserver | null = null;
    async function initialize() {
      try {
        const create = provider === "google" ? (await import("@/lib/neighborhood-map-google")).createGoogleMap : provider === "openstreetmap" ? (await import("@/lib/neighborhood-map-leaflet")).createLeafletMap : null;
        if (!create) throw new Error("invalid_provider");
        if (setup.signal.aborted || !container.current) return;
        instance = await create({ container: container.current, point, signal: setup.signal, onError: () => { if (!setup.signal.aborted) { if (provider === "google") setMapError("O Google Maps não autorizou o carregamento. Confira chave, APIs, faturamento e domínio configurados."); else setTileError(true); } } });
        if (setup.signal.aborted) { instance.destroy(); instance = null; return; }
        driver.current = instance; setReady(true); instance.resize();
        if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(() => instance?.resize()); observer.observe(container.current); }
        void search(instance, "essentials", 500);
      } catch (cause) {
        if (!setup.signal.aborted) setMapError(cause instanceof Error && cause.message === "google_maps_not_configured" ? "O Google Maps ainda precisa de uma chave e um Map ID configurados. Use o link externo para consultar a localização." : "Não foi possível abrir o mapa. Tente novamente ou use o link externo.");
      }
    }
    void initialize();
    return () => { mounted.current = false; setup.abort(); abort.current?.abort(); requesting.current = false; observer?.disconnect(); instance?.destroy(); if (driver.current === instance) driver.current = null; };
  }, [point, search, attempt]);
  function change(next: NearbySelection, distance = radius) {
    setCategory(next); setRadius(distance);
    if (driver.current) void search(driver.current, next, distance);
  }
  const google = provider === "google";
  const label = category === "essentials" ? "Serviços essenciais" : nearbyCategories[category].label;
  return <>
    <div className="neighborhood-intro"><p>Ponto publicado pelo anunciante; pode ser aproximado. Confirme a posição exata antes de visitar.</p><a className="text-link" href={mapsUrl(point)} target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={16} aria-hidden="true" /></a></div>
    <div className="neighborhood-explorer">
      <div className="nearby-toolbar"><div className="nearby-heading"><strong>Seu dia a dia, por perto</strong><span>Explore o que faz diferença na sua rotina.</span></div>
        <label className="nearby-radius">Raio de busca<select value={radius} disabled={!ready || busy || !!mapError} onChange={event => change(category, Number(event.target.value))}><option value={500}>500 m</option><option value={1000}>1 km</option></select></label>
      </div>
      <div className="nearby-categories" aria-label="Categorias de locais próximos">
        {(["essentials", ...Object.keys(nearbyCategories)] as NearbySelection[]).map(key => { const Icon = key === "essentials" ? Layers : icons[key]; return <button key={key} type="button" data-category={key} aria-pressed={category === key} disabled={!ready || busy || !!mapError} onClick={() => change(key)}><Icon size={17} aria-hidden="true" />{key === "essentials" ? "Essenciais" : nearbyCategories[key].label}</button>; })}
      </div>
      <div className="neighborhood-map" aria-label="Mapa do imóvel e locais próximos" aria-busy={!ready && !mapError}>
        <div ref={container} className="neighborhood-map-canvas" />
        {!ready && !mapError && <div className="neighborhood-map-message" role="status">Carregando mapa…</div>}
        {mapError && <div className="neighborhood-map-message" role="alert"><p>{mapError}</p><button className="button secondary" type="button" onClick={() => { setMapError(""); setReady(false); setAttempt(value => value + 1); }}>Tentar abrir mapa</button></div>}
        {ready && !mapError && <button className="neighborhood-recenter" type="button" onClick={() => driver.current?.reset()} aria-label="Centralizar no imóvel" title="Centralizar no imóvel"><LocateFixed size={20} aria-hidden="true" /></button>}
      </div>
      <div className="nearby-results-header"><p role="status" aria-live="polite" aria-atomic="true">{busy ? `Buscando ${label.toLowerCase()}…` : error ? error : searched ? places.length ? `${places.length} locais exibidos · ${label}` : "Nenhum local retornado nesta consulta. A cobertura pode ser incompleta." : "Os locais próximos aparecerão aqui."}</p>
        {ready && !mapError && <button className="text-link" type="button" disabled={busy} onClick={() => { cache.current.delete(`${category}:${radius}`); if (driver.current) void search(driver.current, category, radius); }}><RefreshCw size={14} aria-hidden="true" />{error ? "Tentar novamente" : "Atualizar arredores"}</button>}
      </div>
      {tileError && <p className="neighborhood-note" role="status">Algumas partes do mapa não carregaram. A lista de locais e o link externo continuam disponíveis.</p>}
      <ol className="neighborhood-places">{places.map((place, index) => { const Icon = icons[place.category]; return <li key={place.id} data-category={place.category} className={selection === place.id ? "is-selected" : ""}>
        <button className="neighborhood-select" type="button" onClick={() => choosePlace(place)} aria-pressed={selection === place.id}><span className="neighborhood-number"><Icon size={19} aria-hidden="true" /><span>{index + 1}</span></span><span className="nearby-place-name"><small>{nearbyCategories[place.category].singular}</small><strong>{place.name}</strong></span><span className="nearby-distance"><strong>{formatDistance(place.meters)}</strong><small>em linha reta</small></span></button>
        <div className="neighborhood-links"><a href={place.url} target="_blank" rel="noopener noreferrer">{google ? "Ver no Google Maps" : "Ver no OpenStreetMap"} <ArrowUpRight size={13} aria-hidden="true" /></a><a href={walkingRoute(point, place.point)} target="_blank" rel="noopener noreferrer">Consultar rota <ArrowUpRight size={13} aria-hidden="true" /></a></div>
        {place.attributions?.map((attribution, i) => <small key={i} className="nearby-attribution">{attribution.url ? <a href={attribution.url} target="_blank" rel="noopener noreferrer">{attribution.name}</a> : attribution.name}</small>)}
      </li>; })}</ol>
      <p className="neighborhood-note">Distâncias aproximadas em linha reta a partir do ponto publicado; não são percursos a pé. A linha entre os pontos não representa uma rota. {category === "essentials" ? "Até 3 locais por categoria" : "Até 12 locais"}, dentre os registros retornados. Confirme horários e serviços diretamente com cada local.</p>
      <p className="neighborhood-credit">{google ? <>Mapa e locais: <span className="google-maps-credit" translate="no">Google Maps</span>.</> : <>Dados © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Informar problema no mapa</a>.</>}</p>
    </div>
  </>;
}
