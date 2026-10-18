import { MongoClient } from "mongodb";

let clientPromise = null;

function connect() {
  const { MONGODB_URI, DB_NAME } = process.env;
  if (!MONGODB_URI || !DB_NAME) {
    throw new Error(
      "MONGODB_URI and DB_NAME must be set (see .env.example). Run scripts with node --env-file=.env.",
    );
  }
  const client = new MongoClient(MONGODB_URI);
  return client.connect();
}

export async function getDb() {
  if (!clientPromise) {
    clientPromise = Promise.resolve()
      .then(connect)
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  const client = await clientPromise;
  return client.db(process.env.DB_NAME);
}

export async function closeDb() {
  if (!clientPromise) return;
  const client = await clientPromise;
  clientPromise = null;
  await client.close();
}
