import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareGallery } from "../src/lib/gallery";
test("galeria respeita capa/ordem e não incorpora hosts ou protocolos não autorizados", () => {
  const result = prepareGallery(
    [
      {
        id: 1,
        kind: "image",
        original_url: "https://photos.example/one.jpg",
        position: 0,
      },
      {
        id: 2,
        kind: "image",
        original_url: "https://photos.example/cover.jpg",
        is_cover: true,
        position: 2,
        attribution: "Autor",
      },
      {
        id: 3,
        kind: "floor_plan",
        original_url: "https://photos.example/plan.jpg",
        position: 1,
        width: 0,
      },
      {
        id: 4,
        kind: "image",
        original_url: "https://unknown.example/photo.jpg",
      },
      { id: 5, kind: "video", original_url: "https://example.com/video" },
      { id: 6, kind: "image", original_url: "javascript:alert(1)" },
    ],
    ["photos.example"],
  );
  assert.deepEqual(
    result.photos.map((p) => p.id),
    ["2", "1", "3"],
  );
  assert.equal(result.photos[0].attribution, "Autor");
  assert.equal(result.photos[2].width, undefined);
  assert.equal(result.attachments.length, 2);
  assert.equal(result.photos.length, 3);
});
test("galeria vazia e documentos não inventam contagem de fotos", () => {
  assert.deepEqual(prepareGallery([], []), { photos: [], attachments: [] });
  const r = prepareGallery(
    [{ id: 1, kind: "document", original_url: "https://example.com/doc" }],
    [],
  );
  assert.equal(r.photos.length, 0);
  assert.equal(r.attachments.length, 1);
});
