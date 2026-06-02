// config/database.js
// Exports a singleton Prisma client instance.
// Using a singleton pattern prevents "too many connections" in development
// when hot-reloading creates multiple Prisma instances.
// In production (Render/Railway), this ensures connection pooling works correctly.

const { PrismaClient } = require("@prisma/client");

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // In development, attach to global to survive hot reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  prisma = global.__prisma;
}

module.exports = prisma;