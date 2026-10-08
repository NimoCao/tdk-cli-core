import { createServer } from "node:http";
import { createClient } from "@libsql/client";

// Where Turso's server (examples/byo/turso) listens on the landscape's Docker network.
const url = process.env.LIBSQL_URL ?? "http://turso:4500";
const db = createClient({ url });
// Report only the host: the full URL can carry an auth token.
const dbHost = new URL(url).host;

// /health is a real round trip: it creates a table, writes a row and reads it back, so a 200 means the database answered.
async function roundTrip() {
  await db.execute("create table if not exists visits (id integer primary key autoincrement, at text not null)");
  await db.execute({ sql: "insert into visits (at) values (?)", args: [new Date().toISOString()] });
  const result = await db.execute("select count(*) as n from visits");
  return Number(result.rows[0].n);
}

createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/health" || req.url === "/") {
    try {
      const visits = await roundTrip();
      res.end(JSON.stringify({ status: "ok", database: dbHost, visits }));
    } catch (error) {
      // Keep driver details in the server log; the response carries no stack trace or connection string.
      console.error("health check failed:", error);
      res.statusCode = 503;
      res.end(JSON.stringify({ status: "error", database: dbHost, message: "database unavailable" }));
    }
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
}).listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
