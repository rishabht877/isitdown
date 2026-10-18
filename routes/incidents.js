import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { pageResult, parsePagination } from "../lib/pagination.js";

const SEVERITIES = ["minor", "major", "critical"];
const STATUSES = ["investigating", "identified", "resolved"];
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;

const router = Router();

function parseId(value) {
  return typeof value === "string" &&
    ObjectId.isValid(value) &&
    value.length === 24
    ? new ObjectId(value)
    : null;
}

async function validateIncident(body) {
  const errors = [];
  const data = {};
  const input = body && typeof body === "object" ? body : {};

  data.serviceId = parseId(input.serviceId);
  if (!data.serviceId) {
    errors.push("serviceId must be a valid service id");
  } else {
    const db = await getDb();
    const exists = await db
      .collection("services")
      .countDocuments({ _id: data.serviceId }, { limit: 1 });
    if (!exists) errors.push("serviceId does not match any service");
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    errors.push(
      `title is required and must be at most ${MAX_TITLE} characters`,
    );
  }
  data.title = title;

  if (!SEVERITIES.includes(input.severity)) {
    errors.push(`severity must be one of: ${SEVERITIES.join(", ")}`);
  }
  data.severity = input.severity;

  if (!STATUSES.includes(input.status)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }
  data.status = input.status;

  const startedAt = new Date(input.startedAt);
  if (
    typeof input.startedAt !== "string" ||
    Number.isNaN(startedAt.getTime())
  ) {
    errors.push("startedAt must be a valid ISO date string");
  }
  data.startedAt = startedAt;

  const description = input.description ?? "";
  if (typeof description !== "string" || description.length > MAX_DESCRIPTION) {
    errors.push(
      `description must be a string of at most ${MAX_DESCRIPTION} characters`,
    );
  }
  data.description = typeof description === "string" ? description.trim() : "";

  return { errors, data };
}

const withService = [
  {
    $lookup: {
      from: "services",
      localField: "serviceId",
      foreignField: "_id",
      as: "service",
    },
  },
  {
    $addFields: {
      serviceName: { $ifNull: [{ $first: "$service.name" }, null] },
    },
  },
  { $project: { service: 0 } },
];

router.post("/", async (req, res) => {
  const { errors, data } = await validateIncident(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const now = new Date();
  const incident = { ...data, createdAt: now, updatedAt: now };
  const db = await getDb();
  const { insertedId } = await db.collection("incidents").insertOne(incident);
  res.status(201).json({ ...incident, _id: insertedId });
});

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.serviceId !== undefined) {
    const serviceId = parseId(req.query.serviceId);
    if (!serviceId)
      return res
        .status(400)
        .json({ errors: ["serviceId must be a valid service id"] });
    filter.serviceId = serviceId;
  }
  if (req.query.severity !== undefined) {
    if (!SEVERITIES.includes(req.query.severity)) {
      return res.status(400).json({
        errors: [`severity must be one of: ${SEVERITIES.join(", ")}`],
      });
    }
    filter.severity = req.query.severity;
  }

  const pagination = parsePagination(req.query);
  const collection = (await getDb()).collection("incidents");
  const [items, total] = await Promise.all([
    collection
      .aggregate([
        { $match: filter },
        { $sort: { startedAt: -1, _id: -1 } },
        { $skip: pagination.skip },
        { $limit: pagination.limit },
        ...withService,
      ])
      .toArray(),
    collection.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pagination));
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return res.status(400).json({ errors: ["id must be a valid incident id"] });

  const db = await getDb();
  const [incident] = await db
    .collection("incidents")
    .aggregate([{ $match: { _id: id } }, ...withService])
    .toArray();
  if (!incident)
    return res.status(404).json({ errors: ["Incident not found"] });
  res.json(incident);
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return res.status(400).json({ errors: ["id must be a valid incident id"] });

  const { errors, data } = await validateIncident(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const db = await getDb();
  const updated = await db
    .collection("incidents")
    .findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  if (!updated) return res.status(404).json({ errors: ["Incident not found"] });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return res.status(400).json({ errors: ["id must be a valid incident id"] });

  const db = await getDb();
  const { deletedCount } = await db
    .collection("incidents")
    .deleteOne({ _id: id });
  if (!deletedCount)
    return res.status(404).json({ errors: ["Incident not found"] });
  res.status(204).end();
});

export default router;
