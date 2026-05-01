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

const ordersCreated = new client.Counter({
  name: "orders_created_total",
  help: "Total orders created",
  registers: [register],
});

const orderValue = new client.Histogram({
  name: "order_value_dollars",
  help: "Order value in dollars",
  buckets: [10, 50, 100, 250, 500, 1000],
  registers: [register],
});

const pendingOrders = new client.Gauge({
  name: "pending_orders_total",
  help: "Current pending orders",
  registers: [register],
});

const kafkaMessagesProduced = new client.Counter({
  name: "kafka_messages_produced_total",
  help: "Total Kafka messages produced",
  labelNames: ["topic"],
  registers: [register],
});

// ── Connections ───────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "secret",
  database: process.env.DB_NAME || "appdb",
});

const redisClient = createClient({
  socket: { host: process.env.REDIS_HOST || "localhost", port: process.env.REDIS_PORT || 6379 },
  password: process.env.REDIS_PASSWORD || "redispass",
});
redisClient.connect().catch(console.error);

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || "localhost:9092"] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "order-service-group" });

(async () => {
  await producer.connect().catch(console.error);
  await consumer.connect().catch(console.error);
  await consumer.subscribe({ topic: "user-events", fromBeginning: false }).catch(console.error);
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString());
      console.log(`📨 Received event: ${event.event}`);
    },
  }).catch(console.error);
})();

// ── Middleware ────────────────────────────────
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
  res.json({ status: "ok", service: "order-service" })
);

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/orders", async (req, res) => {
  try {
    const cached = await redisClient.get("orders:all").catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const result = await pool
      .query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100")
      .catch(() => ({ rows: [{ id: 1, user_id: 1, total: 99.99, status: "pending" }] }));

    await redisClient.setEx("orders:all", 30, JSON.stringify(result.rows)).catch(() => {});
    pendingOrders.set(result.rows.filter((o) => o.status === "pending").length);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/orders", async (req, res) => {
  try {
    const { userId, items, total } = req.body;
    const result = await pool
      .query("INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, 'pending') RETURNING *", [
        userId, JSON.stringify(items), total,
      ])
      .catch(() => ({ rows: [{ id: Date.now(), userId, total, status: "pending" }] }));

    ordersCreated.inc();
    if (total) orderValue.observe(Number(total));

    await producer
      .send({ topic: "order-events", messages: [{ value: JSON.stringify({ event: "ORDER_CREATED", order: result.rows[0] }) }] })
      .catch(() => {});
    kafkaMessagesProduced.inc({ topic: "order-events" });

    await redisClient.del("orders:all").catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`✅ order-service running on :${PORT}`));
