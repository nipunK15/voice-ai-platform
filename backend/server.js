// server.js
// Main Express application entry point.
//
// ARCHITECTURE: We keep server.js as the composition root.
// It wires together middleware, routes, and error handling.
// The actual business logic lives in services/controllers, not here.
// This makes the app structure immediately understandable.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const agentRoutes = require("./routes/agents");
const conversationRoutes = require("./routes/conversations");

const webhookRoutes = require("./routes/webhooks");
const errorHandler = require("./middleware/errorHandler");
const prisma = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────

// CORS — allow frontend to talk to backend
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-demo-mode",
    ],
  })
);

// Request logging (combined in prod, dev format in development)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// JSON body parsing — 10mb limit for conversation transcripts
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", async (req, res) => {
  try {
    // Test DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: "1.0.0",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    });
  }
});
app.use(
"/agents",
agentRoutes
)
// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/agents", agentRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/webhooks", webhookRoutes); // Webhooks at root level (no /api prefix)

// ─── API Info ─────────────────────────────────────────────────────────────────

app.get("/api", (req, res) => {
  res.json({
    name: "Voice AI Platform API",
    version: "1.0.0",
    endpoints: {
      agents: "/api/agents",
      conversations: "/api/conversations",
      webhooks: "/webhooks/vapi",
      health: "/health",
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
// Must be last middleware — Express identifies error handlers by 4 args

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     Voice AI Platform API v1.0       ║
╠══════════════════════════════════════╣
║  Port:     ${PORT}                       ║
║  Env:      ${(process.env.NODE_ENV || "development").padEnd(12)}          ║
║  DB:       PostgreSQL via Prisma     ║
╚══════════════════════════════════════╝
  `);
});

// Graceful shutdown — close DB connections properly
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await prisma.$disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;