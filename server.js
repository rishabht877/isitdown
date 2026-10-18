import express from "express";
import { fileURLToPath } from "node:url";
import servicesRouter from "./routes/services.js";
import incidentsRouter from "./routes/incidents.js";

const app = express();
const port = process.env.PORT || 3000;
const publicDir = fileURLToPath(new URL("./public", import.meta.url));

app.use(express.json());
app.use(express.static(publicDir));

app.use("/api/services", servicesRouter);
app.use("/api/incidents", incidentsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ errors: ["Not found"] });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ errors: ["Request body is not valid JSON"] });
  }
  console.error(err.message);
  res.status(500).json({ errors: ["Internal server error"] });
});

app.listen(port, () => {
  console.log(`IsItDown listening on http://localhost:${port}`);
});
