import { test } from "node:test";
import assert from "node:assert/strict";
import { publicCoordinates, publishedContact, distanceMeters, formatDistance, walkingRoute } from "../src/lib/property-location";
import { nearbyQuery, parseNearby } from "../src/lib/nearby";
test("coordenadas ausentes ou inválidas não viram zero; limites são validados", () => {
  for (const latitude of [undefined, null, "", " ", "Infinity", "91", "0;DROP", NaN]) assert.equal(publicCoordinates({ latitude, longitude: 0 }), null);
  assert.deepEqual(publicCoordinates({ latitude: "0", longitude: 0 }), { lat: 0, lng: 0 });
  assert.equal(publicCoordinates({ latitude: -25, longitude: 181 }), null);
});
test("contato só destaca campos identificados e preserva telefone seguro", () => {
  assert.deepEqual(publishedContact("Perto da Rua Azul. Código 41999991234"), { address: null, phone: null, telephone: null });
  const contact = publishedContact("Descrição\nWhatsApp: +55 (41) 99999-1234\nEndereço: Rua Pública, 100\nPreço sob consulta");
  assert.equal(contact.address, "Rua Pública, 100");
  assert.equal(contact.telephone, "tel:+5541999991234");
  assert.equal(publishedContact("Telefone: javascript:alert(1)").telephone, null);
  assert.equal(publishedContact("Telefone: (41) 99999-123456789").telephone, null);
});
test("distância é geodésica aproximada e rotas usam coordenadas explícitas", () => {
  assert.equal(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  const distance = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(distance > 111000 && distance < 112000);
  assert.equal(formatDistance(120), "120 m");
  assert.equal(formatDistance(1500), "1,5 km");
  assert.ok(walkingRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }).includes("travelmode=walking"));
});
test("consulta Overpass restringe categorias raio e resultado sem inventar proximidade", () => {
  const origin = { lat: -25.43, lng: -49.27 };
  assert.match(nearbyQuery(origin, "bakery", 500), /nwr\(around:500,-25.43,-49.27\)\["shop"="bakery"\]/);
  assert.throws(() => nearbyQuery(origin, "bakery", 50000));
  assert.throws(() => nearbyQuery(origin, 'injection' as 'bakery', 500));
  const data = { elements: [
    { type: "node", id: 1, lat: -25.431, lon: -49.27, tags: { name: "Padaria" } },
    { type: "way", id: 2, center: { lat: -25.4302, lon: -49.27 } },
    { type: "node", id: 3, lat: 0, lon: 0 },
    { type: "node", id: 4 },
  ] };
  const places = parseNearby(data, origin, "bakery", 500);
  assert.equal(places.length, 2);
  assert.equal(places[0].name, "Padaria sem nome informado");
  assert.equal(places[0].url, "https://www.openstreetmap.org/way/2");
  assert.throws(() => parseNearby({ ...data, remark: "Query timed out" }, origin, "bakery", 500));
});
