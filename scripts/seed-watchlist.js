import { closeDb, getDb } from "../db/connection.js";

const TARGET_COUNT = 1200;
const MIN_COUNT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 60;

const WATCHING_NOTES = [
  "Keeping an eye on error rates after last week's outage.",
  "Our checkout depends on this. Alert the team if it degrades.",
  "Intermittent timeouts reported, waiting for a status update.",
  "",
];
const WORKAROUND_NOTES = [
  "Falling back to a cached copy of the responses.",
  "Retrying with exponential backoff keeps requests working.",
  "Switched to the secondary endpoint until the fix ships.",
  "Rate limiting avoided by batching calls.",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildEntry(service, now) {
  const status = Math.random() < 0.65 ? "watching" : "worked around";
  const createdAt = new Date(now - Math.random() * HISTORY_DAYS * DAY_MS);
  const updatedAt = new Date(
    createdAt.getTime() + Math.random() * (now - createdAt.getTime()),
  );
  return {
    serviceId: service._id,
    status,
    notes: pick(status === "watching" ? WATCHING_NOTES : WORKAROUND_NOTES),
    createdAt,
    updatedAt,
  };
}

async function main() {
  const db = await getDb();
  const services = await db
    .collection("services")
    .find({}, { projection: { _id: 1 } })
    .toArray();
  if (!services.length) {
    throw new Error("No services found. Run npm run seed:services first.");
  }

  // One entry per service, so the count is capped by how many services exist.
  const chosen = shuffle(services).slice(0, TARGET_COUNT);
  const now = Date.now();
  const entries = chosen.map((service) => buildEntry(service, now));

  const collection = db.collection("watchlist");
  await collection.deleteMany({});
  await collection.insertMany(entries);
  await collection.createIndex({ serviceId: 1 }, { unique: true });
  await collection.createIndex({ status: 1, updatedAt: -1 });
  await collection.createIndex({ updatedAt: -1 });
  console.log(`Seeded ${entries.length} watchlist items`);
  if (entries.length < MIN_COUNT) {
    console.warn(
      `Only ${services.length} services exist, so fewer than ${MIN_COUNT} unique items were possible.`,
    );
  }
}

try {
  await main();
} catch (err) {
  console.error("Seeding watchlist failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
