import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/connection.js";
import { pageResult, parsePagination } from "../lib/pagination.js";

const STATUSES = ["watching", "worked around"];
const MAX_NOTES = 1000;
const DUPLICATE_KEY = 11000;

const router = Router();

function parseId(value) {
  return typeof value === "string" &&
    ObjectId.isValid(value) &&
    value.length === 24
    ? new ObjectId(value)
    : null;
}

async function validateEntry(body) {
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

  if (!STATUSES.includes(input.status)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }
  data.status = input.status;

  const notes = input.notes ?? "";
  if (typeof notes !== "string" || notes.length > MAX_NOTES) {
    errors.push(`notes must be a string of at most ${MAX_NOTES} characters`);
  }
  data.notes = typeof notes === "string" ? notes.trim() : "";

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

const duplicateResponse = (res) =>
  res
    .status(409)
    .json({ errors: ["This service is already on the watchlist"] });

router.post("/", async (req, res) => {
  const { errors, data } = await validateEntry(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const collection = (await getDb()).collection("watchlist");
  if (
    await collection.countDocuments({ serviceId: data.serviceId }, { limit: 1 })
  ) {
    return duplicateResponse(res);
  }

  const now = new Date();
  const entry = { ...data, createdAt: now, updatedAt: now };
  try {
    const { insertedId } = await collection.insertOne(entry);
    res.status(201).json({ ...entry, _id: insertedId });
  } catch (err) {
    if (err.code === DUPLICATE_KEY) return duplicateResponse(res);
    throw err;
  }
});

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.serviceId !== undefined) {
    const serviceId = parseId(req.query.serviceId);
    if (!serviceId) {
      return res
        .status(400)
        .json({ errors: ["serviceId must be a valid service id"] });
    }
    filter.serviceId = serviceId;
  }
  if (req.query.status !== undefined) {
    if (!STATUSES.includes(req.query.status)) {
      return res.status(400).json({
        errors: [`status must be one of: ${STATUSES.join(", ")}`],
      });
    }
    filter.status = req.query.status;
  }

  const pagination = parsePagination(req.query);
  const collection = (await getDb()).collection("watchlist");
  const [items, total] = await Promise.all([
    collection
      .aggregate([
        { $match: filter },
        { $sort: { updatedAt: -1, _id: -1 } },
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
  if (!id) {
    return res
      .status(400)
      .json({ errors: ["id must be a valid watchlist id"] });
  }
  const db = await getDb();
  const [entry] = await db
    .collection("watchlist")
    .aggregate([{ $match: { _id: id } }, ...withService])
    .toArray();
  if (!entry)
    return res.status(404).json({ errors: ["Watchlist item not found"] });
  res.json(entry);
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res
      .status(400)
      .json({ errors: ["id must be a valid watchlist id"] });
  }
  const { errors, data } = await validateEntry(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const collection = (await getDb()).collection("watchlist");
  const clash = await collection.countDocuments(
    { serviceId: data.serviceId, _id: { $ne: id } },
    { limit: 1 },
  );
  if (clash) return duplicateResponse(res);

  try {
    const updated = await collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) {
      return res.status(404).json({ errors: ["Watchlist item not found"] });
    }
    res.json(updated);
  } catch (err) {
    if (err.code === DUPLICATE_KEY) return duplicateResponse(res);
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res
      .status(400)
      .json({ errors: ["id must be a valid watchlist id"] });
  }
  const db = await getDb();
  const { deletedCount } = await db
    .collection("watchlist")
    .deleteOne({ _id: id });
  if (!deletedCount) {
    return res.status(404).json({ errors: ["Watchlist item not found"] });
  }
  res.status(204).end();
});

export default router;
