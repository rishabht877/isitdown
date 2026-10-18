import { Router } from "express";
import { getDb } from "../db/connection.js";
import { pageResult, parsePagination } from "../lib/pagination.js";

const router = Router();

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/categories", async (req, res) => {
  const db = await getDb();
  const categories = await db.collection("services").distinct("category");
  res.json(categories.sort());
});

router.get("/", async (req, res) => {
  const { search, category } = req.query;
  const filter = {};
  if (typeof search === "string" && search.trim()) {
    filter.name = { $regex: escapeRegex(search.trim()), $options: "i" };
  }
  if (typeof category === "string" && category.trim()) {
    filter.category = category.trim();
  }

  const pagination = parsePagination(req.query);
  const collection = (await getDb()).collection("services");
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ name: 1, _id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pagination));
});

export default router;
