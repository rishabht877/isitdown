import { closeDb, getDb } from "../db/connection.js";

const SOURCE_URL =
  "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md";
const ROW = /^\|\s*\[(.+?)\]\((\S+?)\)\s*\|(.*)\|\s*(Yes|No)\s*\|[^|]*\|\s*$/;

function parseServices(markdown) {
  const services = [];
  let category = null;

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^### (.+?)\s*$/);
    if (heading) {
      category = heading[1];
      continue;
    }
    const row = category && line.match(ROW);
    if (!row) continue;

    const [, name, url, middle, https] = row;
    const cut = middle.lastIndexOf("|");
    const description = middle.slice(0, cut).trim();
    const auth = middle
      .slice(cut + 1)
      .replace(/`/g, "")
      .trim();
    services.push({
      name,
      description,
      category,
      auth: auth.toLowerCase() === "no" ? "none" : auth,
      https: https === "Yes",
      url,
    });
  }
  return services;
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok)
    throw new Error(`Could not download dataset (HTTP ${response.status})`);

  const services = parseServices(await response.text());
  if (services.length < 1000) {
    throw new Error(
      `Parsed only ${services.length} services; refusing to seed`,
    );
  }

  const db = await getDb();
  const collection = db.collection("services");
  await collection.deleteMany({});
  await collection.insertMany(services);
  await collection.createIndex({ name: 1 });
  await collection.createIndex({ category: 1 });
  console.log(`Seeded ${services.length} services`);
}

try {
  await main();
} catch (err) {
  console.error("Seeding services failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
