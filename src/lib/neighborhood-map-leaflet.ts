import { formatDistance } from "./property-location";
import { nearbyQuery, parseNearby } from "./nearby";
import { markerContent, type MapOptions, type NeighborhoodMap } from "./neighborhood-map";
import { safeUrl } from "./presentation";
export async function createLeafletMap({ container, point, signal, onError }: MapOptions): Promise<NeighborhoodMap> {
  const L = await import("leaflet");
  signal.throwIfAborted();
  const map = L.map(container, { scrollWheelZoom: false }).setView([point.lat, point.lng], 15);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(map);
  tiles.on("tileerror", onError);
  const home = L.marker([point.lat, point.lng], { icon: L.divIcon({ className: "neighborhood-home-pin", html: markerContent(), iconSize: [86, 44], iconAnchor: [43, 44] }), title: "Ponto publicado do imóvel", alt: "Ponto publicado do imóvel" }).addTo(map);
  home.getElement()?.setAttribute("aria-label", "Ponto publicado do imóvel");
  const group = L.layerGroup().addTo(map);
  const markers = new Map<string, ReturnType<typeof L.marker>>();
  let line: ReturnType<typeof L.polyline> | null = null;
  return {
    setPlaces(places, onSelect) {
      group.clearLayers(); markers.clear(); line?.remove();
      const bounds = L.latLngBounds([[point.lat, point.lng]]);
      places.forEach((place, index) => {
        const marker = L.marker([place.point.lat, place.point.lng], {
          icon: L.divIcon({ className: "neighborhood-place-pin", html: markerContent(place, index), iconSize: [40, 44], iconAnchor: [20, 44] }),
          title: `${place.name}, ${formatDistance(place.meters)} em linha reta`, alt: place.name,
        }).on("click", () => onSelect(place));
        const label = document.createElement("span"); label.textContent = place.name;
        marker.bindTooltip(label); group.addLayer(marker); markers.set(place.id, marker);
        marker.getElement()?.setAttribute("aria-label", `${place.name}, ${formatDistance(place.meters)} em linha reta`);
        bounds.extend([place.point.lat, place.point.lng]);
      });
      if (places.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: false });
    },
    select(place) {
      markers.forEach((marker, id) => { marker.getElement()?.classList.toggle("is-selected", id === place.id); marker.setZIndexOffset(id === place.id ? 2000 : 0); });
      markers.get(place.id)?.openTooltip(); line?.remove();
      line = L.polyline([[point.lat, point.lng], [place.point.lat, place.point.lng]], { color: "#6b7280", weight: 2, dashArray: "6 7" }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [55, 55], maxZoom: 17, animate: false });
    },
    reset() { map.setView([point.lat, point.lng], 15, { animate: false }); },
    resize() { map.invalidateSize({ animate: false, pan: false }); },
    async search(category, radius, requestSignal) {
      const endpoint = safeUrl(process.env.NEXT_PUBLIC_OVERPASS_API_URL || "https://overpass.private.coffee/api/interpreter");
      if (!endpoint) throw new Error("invalid_provider");
      const response = await fetch(endpoint, { method: "POST", body: new URLSearchParams({ data: nearbyQuery(point, category, radius) }), signal: requestSignal, credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error(response.status === 429 ? "rate_limited" : "nearby_unavailable");
      return parseNearby(await response.json(), point, category, radius);
    },
    destroy() { tiles.off("tileerror", onError); map.remove(); },
  };
}
