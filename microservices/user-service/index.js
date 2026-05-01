const express = require("express");
const client = require("prom-client");
const { Pool } = require("pg");
const { createClient } = require("redis");
const { Kafka } = require("kafkajs");

const app = express();
app.use(express.json());

// ── Prometheus Metrics ────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const activeUsers = new client.Gauge({
  name: "active_users_total",
  help: "Number of active users",
  registers: [register],
});

const kafkaMessagesProduced = new client.Counter({
  name: "kafka_messages_produced_total",
  help: "Total Kafka messages produced",
  labelNames: ["topic"],
  registers: [register],
});

// ── DB Setup ──────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "secret",
  database: process.env.DB_NAME || "appdb",
});

// ── Redis Setup ───────────────────────────────
const redisClient = createClient({
  socket: { host: process.env.REDIS_HOST || "localhost", port: process.env.REDIS_PORT || 6379 },
  password: process.env.REDIS_PASSWORD || "redispass",
});
redisClient.connect().catch(console.error);

// ── Kafka Setup ───────────────────────────────
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] });
const producer = kafka.producer();
producer.connect().catch(console.error);

// ── Metrics middleware ────────────────────────
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    httpRequestsTotal.inc({ method: req.method, route: req.path, status: res.statusCode });
    end({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

// ── Routes ────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "user-service" })
);

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/users", async (req, res) => {
  try {
    // Try Redis cache first
    const cached = await redisClient.get("users:all").catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    // Fallback to DB
    const result = await pool.query("SELECT id, name, email FROM users LIMIT 100").catch(() => ({
      rows: [{ id: 1, name: "Alice", email: "alice@example.com" }],
    }));

    await redisClient.setEx("users:all", 60, JSON.stringify(result.rows)).catch(() => {});
    activeUsers.set(result.rows.length);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await pool
      .query("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *", [name, email])
      .catch(() => ({ rows: [{ id: Date.now(), name, email }] }));

    // Publish event to Kafka
    await producer
      .send({ topic: "user-events", messages: [{ value: JSON.stringify({ event: "USER_CREATED", user: result.rows[0] }) }] })
      .catch(() => {});
    kafkaMessagesProduced.inc({ topic: "user-events" });

    // Invalidate cache
    await redisClient.del("users:all").catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ user-service running on :${PORT}`));
