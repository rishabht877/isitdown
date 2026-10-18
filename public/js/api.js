export class ApiError extends Error {
  constructor(status, messages) {
    super(messages.join(" "));
    this.status = status;
  }
}

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

export function searchServices(params) {
  return request(`/api/services${toQuery(params)}`);
}

export function listIncidents(params) {
  return request(`/api/incidents${toQuery(params)}`);
}

export function getIncident(id) {
  return request(`/api/incidents/${id}`);
}

export function createIncident(incident) {
  return request("/api/incidents", { method: "POST", body: incident });
}

export function updateIncident(id, incident) {
  return request(`/api/incidents/${id}`, { method: "PUT", body: incident });
}

export function deleteIncident(id) {
  return request(`/api/incidents/${id}`, { method: "DELETE" });
}
