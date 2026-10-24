import type { Coordinates } from "./property-location";
import type { NearbyPlace, NearbySelection } from "./nearby";
export type NeighborhoodMap = {
  setPlaces: (places: NearbyPlace[], onSelect: (place: NearbyPlace) => void) => void;
  select: (place: NearbyPlace) => void;
  reset: () => void;
  resize: () => void;
  search: (category: NearbySelection, radius: number, signal: AbortSignal) => Promise<NearbyPlace[]>;
  destroy: () => void;
};
export type MapOptions = { container: HTMLElement; point: Coordinates; signal: AbortSignal; onError: () => void };
export function markerContent(place?: NearbyPlace, index = 0) {
  const element = document.createElement("span");
  element.className = place ? "poi-marker" : "home-marker";
  if (place) element.dataset.category = place.category;
  if (place) { const number = document.createElement("span"); number.textContent = String(index + 1); element.append(number); }
  else element.textContent = "Imóvel";
  return element;
}
export function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(new DOMException("Cancelled", "AbortError"));
    if (signal.aborted) { void operation.catch(() => {}); stop(); return; }
    signal.addEventListener("abort", stop, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
