import { closeDb, getDb } from "../db/connection.js";

const INCIDENT_COUNT = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;

const SCENARIOS = [
  {
    title: (s) => `Elevated error rates on ${s}`,
    description: (s) =>
      `Requests to ${s} are failing intermittently with 5xx responses. Retrying usually succeeds after a few attempts.`,
  },
  {
    title: (s) => `Increased latency for ${s} requests`,
    description: (s) =>
      `Median response time for ${s} has more than tripled. Clients with short timeouts are seeing failures.`,
  },
  {
    title: (s) => `${s} returning 503 Service Unavailable`,
    description: (s) =>
      `Every endpoint on ${s} responds with 503. The status page has not been updated yet.`,
  },
  {
    title: (s) => `Authentication failures on ${s}`,
    description: (s) =>
      `Valid credentials are being rejected by ${s} with 401 and 403 errors. Rotating keys did not help.`,
  },
  {
    title: (s) => `Timeouts connecting to ${s}`,
    description: (s) =>
      `Connections to ${s} hang until the client gives up. DNS resolves correctly, so the problem looks network related.`,
  },
  {
    title: (s) => `${s} serving stale data`,
    description: (s) =>
      `Responses from ${s} are hours behind and do not reflect recent updates. The data appears to be cached.`,
  },
  {
    title: (s) => `TLS certificate error on ${s}`,
    description: (s) =>
      `Clients report certificate validation errors when calling ${s}. The certificate appears to have expired.`,
  },
  {
    title: (s) => `Rate limiting too aggressive on ${s}`,
    description: (s) =>
      `${s} is returning 429 after only a handful of requests, far below the documented limit.`,
  },
  {
    title: (s) => `Malformed responses from ${s}`,
    description: (s) =>
      `JSON returned by ${s} is truncated or missing fields, which breaks client parsers.`,
  },
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function weightedSeverity() {
  const roll = Math.random();
  if (roll < 0.55) return "minor";
  if (roll < 0.85) return "major";
  return "critical";
}

function statusFor(ageMs) {
  if (ageMs > 2 * DAY_MS)
    return Math.random() < 0.95 ? "resolved" : "identified";
  const roll = Math.random();
  if (roll < 0.35) return "investigating";
  if (roll < 0.65) return "identified";
  return "resolved";
}

function buildIncident(service, now) {
  const scenario = pick(SCENARIOS);
  const ageMs = Math.random() * HISTORY_DAYS * DAY_MS;
  const startedAt = new Date(now - ageMs);
  const createdAt = new Date(
    startedAt.getTime() + Math.random() * 20 * 60 * 1000,
  );
  const updatedAt = new Date(
    Math.min(now, createdAt.getTime() + Math.random() * 6 * 60 * 60 * 1000),
  );

  return {
    serviceId: service._id,
    title: scenario.title(service.name),
    severity: weightedSeverity(),
    status: statusFor(ageMs),
    startedAt,
    description: scenario.description(service.name),
    createdAt,
    updatedAt,
  };
}

async function main() {
  const db = await getDb();
  const services = await db
    .collection("services")
    .find({}, { projection: { name: 1 } })
    .toArray();
  if (!services.length)
    throw new Error("No services found. Run npm run seed:services first.");

  const now = Date.now();
  const incidents = Array.from({ length: INCIDENT_COUNT }, () =>
    buildIncident(pick(services), now),
  );

  const collection = db.collection("incidents");
  await collection.deleteMany({});
  await collection.insertMany(incidents);
  await collection.createIndex({ startedAt: -1 });
  await collection.createIndex({ serviceId: 1, startedAt: -1 });
  await collection.createIndex({ severity: 1, startedAt: -1 });
  console.log(
    `Seeded ${incidents.length} incidents across ${services.length} services`,
  );
}

try {
  await main();
} catch (err) {
  console.error("Seeding incidents failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
