import { el } from "./dom.js";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Incidents", href: "/incidents.html" },
  { label: "Watchlist", href: "/watchlist.html" },
];

function currentPath() {
  const { pathname } = window.location;
  return pathname === "/index.html" ? "/" : pathname;
}

export function renderNav() {
  const container = document.querySelector(".site-nav");
  if (!container) return;

  const current = currentPath();
  const items = LINKS.map(({ label, href }) => {
    const props = { href, text: label };
    if (href === current) props["aria-current"] = "page";
    return el("li", {}, [el("a", props)]);
  });

  container.replaceChildren(
    el("nav", { "aria-label": "Main" }, [
      el("a", { className: "brand", href: "/", text: "IsItDown" }),
      el("ul", { className: "nav-links" }, items),
    ]),
  );
}
