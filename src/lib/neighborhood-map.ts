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
  else {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [name, value] of Object.entries({ viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(name, value);
    const house = document.createElementNS("http://www.w3.org/2000/svg", "path");
    house.setAttribute("d", "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z");
    svg.append(house); element.append(svg);
  }
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
