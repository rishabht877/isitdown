import { searchServices } from "./api.js";
import { option } from "./dom.js";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 20;

// Wires a search box to a select that lists matching services.
export function createServicePicker({
  searchInput,
  select,
  placeholder,
  onChange,
}) {
  let timer = null;
  let requestId = 0;

  // The currently chosen service stays in the list even when a new search no longer matches it.
  function setOptions(services) {
    const keptId = select.value;
    const keptName = select.selectedOptions[0]?.textContent;
    select.replaceChildren(option("", placeholder));
    for (const service of services) {
      select.append(option(service._id, service.name));
    }
    if (keptId) {
      if (!select.querySelector(`option[value="${keptId}"]`)) {
        select.append(option(keptId, keptName));
      }
      select.value = keptId;
    }
  }

  async function search() {
    const current = requestId + 1;
    requestId = current;
    try {
      const { items } = await searchServices({
        search: searchInput.value.trim(),
        limit: RESULT_LIMIT,
      });
      if (current !== requestId) return;
      setOptions(items);
    } catch {
      if (current !== requestId) return;
      select.replaceChildren(option("", "Could not load services"));
    }
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, DEBOUNCE_MS);
  });
  select.addEventListener("change", () => onChange?.(select.value));

  setOptions([]);
  search();

  return {
    // Makes sure a specific service (e.g. the one on an incident being edited) is selectable.
    selectService(id, name) {
      searchInput.value = "";
      if (!select.querySelector(`option[value="${id}"]`)) {
        select.append(option(id, name ?? "Unknown service"));
      }
      select.value = id;
    },
    reset() {
      searchInput.value = "";
      select.value = "";
      search();
    },
  };
}
