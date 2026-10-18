import { listIncidents, searchServices } from "./api.js";
import { el } from "./dom.js";
import { renderNav } from "./nav.js";

const LATEST_COUNT = 5;

const stats = document.querySelector("#stats");
const latestList = document.querySelector("#latest-incidents");
const latestMessage = document.querySelector("#latest-message");

function renderIncident(incident) {
  const meta = `${incident.serviceName ?? "Unknown service"} · ${incident.status}`;
  return el("li", { className: "latest-item" }, [
    el("div", { className: "latest-head" }, [
      el("h3", { text: incident.title }),
      el("strong", {
        className: `badge ${incident.severity}`,
        text: incident.severity,
      }),
    ]),
    el("p", { className: "meta", text: meta }),
  ]);
}

function showLatest(result) {
  if (result.status === "rejected") {
    latestMessage.textContent =
      "Could not load the latest incidents. Please try again later.";
    latestMessage.classList.add("error");
    return;
  }
  const { items } = result.value;
  latestList.replaceChildren(...items.map(renderIncident));
  latestMessage.textContent = items.length ? "" : "No incidents reported yet.";
}

function showStats(servicesResult, incidentsResult) {
  if (
    servicesResult.status === "rejected" ||
    incidentsResult.status === "rejected"
  ) {
    stats.textContent = "Stats are unavailable right now.";
    return;
  }
  const services = servicesResult.value.total.toLocaleString();
  const incidents = incidentsResult.value.total.toLocaleString();
  stats.textContent = `Tracking ${services} services and ${incidents} incidents.`;
}

async function load() {
  const [servicesResult, incidentsResult] = await Promise.allSettled([
    searchServices({ limit: 1 }),
    listIncidents({ limit: LATEST_COUNT }),
  ]);
  showStats(servicesResult, incidentsResult);
  showLatest(incidentsResult);
}

renderNav();
load();
