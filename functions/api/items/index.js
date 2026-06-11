import {
  errorResponse,
  isValidItem,
  jsonResponse,
  normalizeItem,
  readJsonBody,
  rowToItem
} from "../../_lib.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM items ORDER BY created_at"
  ).all();
  return jsonResponse(results.map(rowToItem));
}

export async function onRequestPost({ request, env }) {
  const body = await readJsonBody(request);
  if (body === null) {
    return errorResponse(400, "Die Anfrage konnte nicht gelesen werden.");
  }

  const fields = normalizeItem(body);
  if (!isValidItem(fields)) {
    return errorResponse(400, "Bitte Mitbringsel, Menge und Namen eintragen.");
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    ...fields,
    createdAt: now,
    updatedAt: now
  };

  await env.DB.prepare(
    "INSERT INTO items (id, item, quantity, person, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
  )
    .bind(entry.id, entry.item, entry.quantity, entry.person, now, now)
    .run();

  return jsonResponse(entry, 201);
}
