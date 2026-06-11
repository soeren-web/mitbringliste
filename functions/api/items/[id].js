import {
  errorResponse,
  isValidItem,
  jsonResponse,
  normalizeItem,
  readJsonBody,
  rowToItem
} from "../../_lib.js";

export async function onRequestPut({ request, env, params }) {
  const body = await readJsonBody(request);
  if (body === null) {
    return errorResponse(400, "Die Anfrage konnte nicht gelesen werden.");
  }

  const fields = normalizeItem(body);
  if (!isValidItem(fields)) {
    return errorResponse(400, "Bitte Mitbringsel, Menge und Namen eintragen.");
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE items SET item = ?1, quantity = ?2, person = ?3, updated_at = ?4 WHERE id = ?5"
  )
    .bind(fields.item, fields.quantity, fields.person, now, params.id)
    .run();

  if (result.meta.changes === 0) {
    return errorResponse(404, "Eintrag nicht gefunden.");
  }

  const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?1")
    .bind(params.id)
    .first();
  return jsonResponse(rowToItem(row));
}

export async function onRequestDelete({ env, params }) {
  const result = await env.DB.prepare("DELETE FROM items WHERE id = ?1")
    .bind(params.id)
    .run();

  if (result.meta.changes === 0) {
    return errorResponse(404, "Eintrag nicht gefunden.");
  }

  return jsonResponse({ ok: true });
}
