import {
  createIncident,
  deleteIncident,
  getIncident,
  listIncidents,
  updateIncident,
} from "./api.js";
import { el } from "./dom.js";
import { renderNav } from "./nav.js";
import { createServicePicker } from "./service-picker.js";

const PAGE_SIZE = 10;

renderNav();

const form = document.querySelector("#incident-form");
const fields = {
  id: document.querySelector("#incident-id"),
  service: document.querySelector("#form-service"),
  title: document.querySelector("#title"),
  severity: document.querySelector("#severity"),
  status: document.querySelector("#status"),
  startedAt: document.querySelector("#started-at"),
  description: document.querySelector("#description"),
};
const formHeading = document.querySelector("#form-heading");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");

const filterSeverity = document.querySelector("#filter-severity");
const filterService = document.querySelector("#filter-service");
const list = document.querySelector("#incident-list");
const listMessage = document.querySelector("#list-message");
const pageInfo = document.querySelector("#page-info");
const prevButton = document.querySelector("#prev-button");
const nextButton = document.querySelector("#next-button");

let page = 1;

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
    loadIncidents();
  },
});

function toLocalInput(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function setMessage(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle("error", isError);
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  fields.startedAt.value = toLocalInput(new Date());
  formPicker.reset();
  formHeading.textContent = "Report an incident";
  submitButton.textContent = "Add incident";
  cancelButton.hidden = true;
}

function fillForm(incident) {
  fields.id.value = incident._id;
  formPicker.selectService(incident.serviceId, incident.serviceName);
  fields.title.value = incident.title;
  fields.severity.value = incident.severity;
  fields.status.value = incident.status;
  fields.startedAt.value = toLocalInput(new Date(incident.startedAt));
  fields.description.value = incident.description;
  formHeading.textContent = "Edit incident";
  submitButton.textContent = "Save changes";
  cancelButton.hidden = false;
}

function readForm() {
  return {
    serviceId: fields.service.value,
    title: fields.title.value,
    severity: fields.severity.value,
    status: fields.status.value,
    startedAt: new Date(fields.startedAt.value).toISOString(),
    description: fields.description.value,
  };
}

function renderIncident(incident) {
  const started = new Date(incident.startedAt).toLocaleString();
  const meta = `${incident.serviceName ?? "Unknown service"} · ${incident.status} · started ${started}`;

  const editButton = el("button", { type: "button", text: "Edit" });
  editButton.addEventListener("click", () => startEdit(incident._id));

  const deleteButton = el("button", {
    type: "button",
    className: "danger",
    text: "Delete",
  });
  deleteButton.addEventListener("click", () => removeIncident(incident));

  return el("li", { className: "incident" }, [
    el("div", { className: "incident-head" }, [
      el("h3", { text: incident.title }),
      el("strong", {
        className: `badge ${incident.severity}`,
        text: incident.severity,
      }),
    ]),
    el("p", { className: "meta", text: meta }),
    el("p", { text: incident.description }),
    el("div", { className: "actions" }, [editButton, deleteButton]),
  ]);
}

async function loadIncidents() {
  setMessage(listMessage, "Loading incidents…");
  try {
    const data = await listIncidents({
      page,
      limit: PAGE_SIZE,
      serviceId: filterService.value,
      severity: filterSeverity.value,
    });
    if (data.items.length === 0 && page > 1) {
      page = data.totalPages;
      return loadIncidents();
    }
    list.replaceChildren(...data.items.map(renderIncident));
    setMessage(
      listMessage,
      data.total === 0 ? "No incidents match these filters." : "",
    );
    pageInfo.textContent = `Page ${data.page} of ${data.totalPages} (${data.total} incidents)`;
    prevButton.disabled = data.page <= 1;
    nextButton.disabled = data.page >= data.totalPages;
  } catch (err) {
    list.replaceChildren();
    setMessage(listMessage, `Could not load incidents: ${err.message}`, true);
  }
}

async function startEdit(id) {
  try {
    fillForm(await getIncident(id));
    setMessage(formMessage, "");
    form.scrollIntoView({ behavior: "smooth" });
    fields.title.focus();
  } catch (err) {
    setMessage(listMessage, `Could not load incident: ${err.message}`, true);
  }
}

async function removeIncident(incident) {
  if (!window.confirm(`Delete "${incident.title}"?`)) return;
  try {
    await deleteIncident(incident._id);
    if (fields.id.value === incident._id) resetForm();
    await loadIncidents();
  } catch (err) {
    setMessage(listMessage, `Could not delete incident: ${err.message}`, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = fields.id.value;
  submitButton.disabled = true;
  try {
    const incident = readForm();
    if (id) await updateIncident(id, incident);
    else await createIncident(incident);
    resetForm();
    setMessage(formMessage, id ? "Incident updated." : "Incident added.");
    if (!id) page = 1;
    await loadIncidents();
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

filterSeverity.addEventListener("change", () => {
  page = 1;
  loadIncidents();
});

prevButton.addEventListener("click", () => {
  page -= 1;
  loadIncidents();
});

nextButton.addEventListener("click", () => {
  page += 1;
  loadIncidents();
});

document
  .querySelector("#filters")
  .addEventListener("submit", (event) => event.preventDefault());

fields.startedAt.value = toLocalInput(new Date());
loadIncidents();
