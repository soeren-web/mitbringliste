const form = document.querySelector("#entry-form");
const tableBody = document.querySelector("#items");
const rowTemplate = document.querySelector("#row-template");
const editRowTemplate = document.querySelector("#edit-row-template");
const emptyState = document.querySelector("#empty-state");
const statusEl = document.querySelector("#status");
const countEl = document.querySelector("#count");

const FIELDS = ["item", "quantity", "person"];

let items = [];
let activeEdits = new Map();
let saveTimers = new Map();
let editingId = null;

function setStatus(text, offline = false) {
  statusEl.textContent = offline ? text : "";
  statusEl.classList.toggle("offline", offline);
}

function itemLabel(count) {
  return count === 1 ? "1 Eintrag" : `${count} Einträge`;
}

function render(nextItems) {
  items = nextItems;
  const focusedName = document.activeElement?.name;

  tableBody.innerHTML = "";
  emptyState.classList.toggle("visible", items.length === 0);
  countEl.textContent = itemLabel(items.length);

  for (const entry of items) {
    tableBody.append(entry.id === editingId ? buildEditRow(entry) : buildTextRow(entry));
  }

  if (editingId && focusedName) {
    tableBody.querySelector(`tr[data-id="${editingId}"] [name="${focusedName}"]`)?.focus();
  }
}

function buildTextRow(entry) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.id = entry.id;
  row.querySelector(".cell-item").textContent = entry.item;
  row.querySelector(".cell-quantity").textContent = entry.quantity;
  row.querySelector(".cell-person").textContent = entry.person;

  row.addEventListener("click", () => startEditing(entry.id));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter") startEditing(entry.id);
  });

  return row;
}

function buildEditRow(entry) {
  const row = editRowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.id = entry.id;

  for (const field of FIELDS) {
    const input = row.querySelector(`[name="${field}"]`);
    input.value = activeEdits.get(`${entry.id}:${field}`) ?? entry[field] ?? "";
    input.addEventListener("input", () => {
      activeEdits.set(`${entry.id}:${field}`, input.value);
      scheduleSave(entry.id);
    });
    input.addEventListener("blur", () => saveRow(entry.id));
  }

  row.querySelector(".done-button").addEventListener("click", () => finishEditing(entry.id));
  row.querySelector(".delete-button").addEventListener("click", () => {
    editingId = null;
    deleteRow(entry.id);
  });

  return row;
}

function startEditing(id) {
  if (editingId === id) return;
  editingId = id;
  render(items);
  tableBody.querySelector(`tr[data-id="${id}"] [name="item"]`)?.focus();
}

async function finishEditing(id) {
  await saveRow(id);
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);
  for (const field of FIELDS) {
    activeEdits.delete(`${id}:${field}`);
  }
  editingId = null;
  render(items);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Die Änderung konnte nicht gespeichert werden.");
  return payload;
}

async function loadItems() {
  try {
    render(await requestJson("/api/items"));
    setStatus("Verbunden");
  } catch {
    setStatus("Offline", true);
  }
}

function getEditedEntry(id) {
  const original = items.find((entry) => entry.id === id);
  if (!original) return null;

  return {
    item: activeEdits.get(`${id}:item`) ?? original.item,
    quantity: activeEdits.get(`${id}:quantity`) ?? original.quantity,
    person: activeEdits.get(`${id}:person`) ?? original.person
  };
}

function scheduleSave(id) {
  clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => saveRow(id), 450));
}

async function saveRow(id) {
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);

  if (!FIELDS.some((field) => activeEdits.has(`${id}:${field}`))) return;

  const edited = getEditedEntry(id);
  if (!edited || !edited.item.trim() || !edited.quantity.trim() || !edited.person.trim()) return;

  try {
    const updated = await requestJson(`/api/items/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(edited)
    });

    for (const field of FIELDS) {
      activeEdits.delete(`${id}:${field}`);
    }
    render(items.map((entry) => (entry.id === id ? updated : entry)));
    setStatus("Gespeichert");
  } catch {
    setStatus("Nicht gespeichert", true);
  }
}

async function deleteRow(id) {
  try {
    await requestJson(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
    render(items.filter((entry) => entry.id !== id));
    setStatus("Gespeichert");
  } catch {
    setStatus("Nicht gelöscht", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  try {
    const created = await requestJson("/api/items", {
      method: "POST",
      body: JSON.stringify(data)
    });
    render([...items, created]);
    form.reset();
    document.querySelector("#item").focus();
    setStatus("Gespeichert");
  } catch (error) {
    setStatus(error.message, true);
  }
});

const POLL_INTERVAL_MS = 5000;

function startPolling() {
  setInterval(() => {
    if (editingId || activeEdits.size > 0 || saveTimers.size > 0) return;
    loadItems();
  }, POLL_INTERVAL_MS);
}

loadItems();
startPolling();
