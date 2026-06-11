export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function errorResponse(status, message) {
  return jsonResponse({ error: message }, status);
}

function sanitizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeItem(input = {}) {
  return {
    item: sanitizeText(input.item, 120),
    quantity: sanitizeText(input.quantity, 80),
    person: sanitizeText(input.person, 80)
  };
}

export function isValidItem(item) {
  return Boolean(item.item && item.quantity && item.person);
}

export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return null;
  }
}

export function rowToItem(row) {
  return {
    id: row.id,
    item: row.item,
    quantity: row.quantity,
    person: row.person,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
