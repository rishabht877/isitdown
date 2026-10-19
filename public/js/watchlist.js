import { ApiError } from "./api.js";
import { el } from "./dom.js";
import { renderNav } from "./nav.js";
import { createServicePicker } from "./service-picker.js";

const PAGE_SIZE = 10;
const BASE = "/api/watchlist";

renderNav();

const form = document.querySelector("#watch-form");
const fields = {
  id: document.querySelector("#watch-id"),
  service: document.querySelector("#form-service"),
  status: document.querySelector("#status"),
  notes: document.querySelector("#notes"),
};
const formHeading = document.querySelector("#form-heading");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");

const filterStatus = document.querySelector("#filter-status");
const filterService = document.querySelector("#filter-service");
const list = document.querySelector("#watch-list");
const listMessage = document.querySelector("#list-message");
const pageInfo = document.querySelector("#page-info");
const prevButton = document.querySelector("#prev-button");
const nextButton = document.querySelector("#next-button");

let page = 1;

async function request(path, options = {}) {
  const init = { ...options };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.errors ?? ["Request failed"]);
  }
  return payload;
}

function toQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

const listEntries = (params) => request(`${BASE}${toQuery(params)}`);
const getEntry = (id) => request(`${BASE}/${id}`);
const createEntry = (entry) => request(BASE, { method: "POST", body: entry });
const updateEntry = (id, entry) =>
  request(`${BASE}/${id}`, { method: "PUT", body: entry });
const deleteEntry = (id) => request(`${BASE}/${id}`, { method: "DELETE" });

const formPicker = createServicePicker({
  searchInput: document.querySelector("#form-service-search"),
  select: fields.service,
  placeholder: "Choose a service",
});

createServicePicker({
  searchInput: document.querySelector("#filter-service-search"),
  select: filterService,
  placeholder: "All services",
  onChange: () => {
    page = 1;
    loadEntries();
  },
});

function setMessage(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle("error", isError);
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  formPicker.reset();
  formHeading.textContent = "Add a service to the watchlist";
  submitButton.textContent = "Add to watchlist";
  cancelButton.hidden = true;
}

function fillForm(entry) {
  fields.id.value = entry._id;
  formPicker.selectService(entry.serviceId, entry.serviceName);
  fields.status.value = entry.status;
  fields.notes.value = entry.notes;
  formHeading.textContent = "Edit watchlist item";
  submitButton.textContent = "Save changes";
  cancelButton.hidden = false;
}

function readForm() {
  return {
    serviceId: fields.service.value,
    status: fields.status.value,
    notes: fields.notes.value,
  };
}

function renderEntry(entry) {
  const meta = `Added ${new Date(entry.createdAt).toLocaleString()} · updated ${new Date(entry.updatedAt).toLocaleString()}`;

  const editButton = el("button", { type: "button", text: "Edit" });
  editButton.addEventListener("click", () => startEdit(entry._id));

  const deleteButton = el("button", {
    type: "button",
    className: "danger",
    text: "Delete",
  });
  deleteButton.addEventListener("click", () => removeEntry(entry));

  const statusClass =
    entry.status === "watching" ? "watching" : "worked-around";
  const children = [
    el("div", { className: "watch-head" }, [
      el("h3", { text: entry.serviceName ?? "Unknown service" }),
      el("strong", {
        className: `status-badge ${statusClass}`,
        text: entry.status,
      }),
    ]),
    el("p", { className: "meta", text: meta }),
  ];
  if (entry.notes) children.push(el("p", { text: entry.notes }));
  children.push(
    el("div", { className: "actions" }, [editButton, deleteButton]),
  );

  return el("li", { className: `watch-item ${statusClass}` }, children);
}

async function loadEntries() {
  setMessage(listMessage, "Loading watchlist…");
  try {
    const data = await listEntries({
      page,
      limit: PAGE_SIZE,
      serviceId: filterService.value,
      status: filterStatus.value,
    });
    if (data.items.length === 0 && page > 1) {
      page = data.totalPages;
      return loadEntries();
    }
    list.replaceChildren(...data.items.map(renderEntry));
    setMessage(
      listMessage,
      data.total === 0 ? "No watchlist items match these filters." : "",
    );
    pageInfo.textContent = `Page ${data.page} of ${data.totalPages} (${data.total} items)`;
    prevButton.disabled = data.page <= 1;
    nextButton.disabled = data.page >= data.totalPages;
  } catch (err) {
    list.replaceChildren();
    setMessage(listMessage, `Could not load watchlist: ${err.message}`, true);
  }
}

async function startEdit(id) {
  try {
    fillForm(await getEntry(id));
    setMessage(formMessage, "");
    form.scrollIntoView({ behavior: "smooth" });
    fields.status.focus();
  } catch (err) {
    setMessage(listMessage, `Could not load item: ${err.message}`, true);
  }
}

async function removeEntry(entry) {
  const name = entry.serviceName ?? "this service";
  if (!window.confirm(`Remove ${name} from the watchlist?`)) return;
  try {
    await deleteEntry(entry._id);
    if (fields.id.value === entry._id) resetForm();
    await loadEntries();
  } catch (err) {
    setMessage(listMessage, `Could not delete item: ${err.message}`, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = fields.id.value;
  submitButton.disabled = true;
  try {
    const entry = readForm();
    if (id) await updateEntry(id, entry);
    else await createEntry(entry);
    resetForm();
    setMessage(
      formMessage,
      id ? "Watchlist item updated." : "Added to watchlist.",
    );
    if (!id) page = 1;
    await loadEntries();
  } catch (err) {
    setMessage(formMessage, err.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

cancelButton.addEventListener("click", () => {
  resetForm();
  setMessage(formMessage, "");
});

filterStatus.addEventListener("change", () => {
  page = 1;
  loadEntries();
});

prevButton.addEventListener("click", () => {
  page -= 1;
  loadEntries();
});

nextButton.addEventListener("click", () => {
  page += 1;
  loadEntries();
});

document
  .querySelector("#filters")
  .addEventListener("submit", (event) => event.preventDefault());

loadEntries();
