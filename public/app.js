const form = document.querySelector("#entry-form");
const tableBody = document.querySelector("#items");
const rowTemplate = document.querySelector("#row-template");
const emptyState = document.querySelector("#empty-state");
const statusEl = document.querySelector("#status");
const countEl = document.querySelector("#count");

let items = [];
let activeEdits = new Map();
let saveTimers = new Map();

function setStatus(text, offline = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("offline", offline);
}

function itemLabel(count) {
  return count === 1 ? "1 Eintrag" : `${count} Einträge`;
}

function render(nextItems) {
  items = nextItems;
  const focused = document.activeElement;
  const focusedRow = focused?.closest?.("tr")?.dataset.id;
  const focusedName = focused?.name;

  tableBody.innerHTML = "";
  emptyState.classList.toggle("visible", items.length === 0);
  countEl.textContent = itemLabel(items.length);

  for (const entry of items) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = entry.id;

    for (const field of ["item", "quantity", "person"]) {
      const input = row.querySelector(`[name="${field}"]`);
      input.value = activeEdits.get(`${entry.id}:${field}`) ?? entry[field] ?? "";
      input.addEventListener("input", () => {
        activeEdits.set(`${entry.id}:${field}`, input.value);
        scheduleSave(entry.id);
      });
      input.addEventListener("blur", () => saveRow(entry.id));
    }

    row.querySelector(".delete-button").addEventListener("click", () => deleteRow(entry.id));
    tableBody.append(row);
  }

  if (focusedRow && focusedName) {
    const nextFocus = tableBody.querySelector(`tr[data-id="${focusedRow}"] [name="${focusedName}"]`);
    nextFocus?.focus();
  }
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

  const edited = getEditedEntry(id);
  if (!edited || !edited.item.trim() || !edited.quantity.trim() || !edited.person.trim()) return;

  try {
    const updated = await requestJson(`/api/items/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(edited)
    });

    for (const field of ["item", "quantity", "person"]) {
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
    if (activeEdits.size > 0 || saveTimers.size > 0) return;
    loadItems();
  }, POLL_INTERVAL_MS);
}

loadItems();
startPolling();
