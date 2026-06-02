// middleware/auth.js
// Placeholder authentication middleware for MVP.
//
// ARCHITECTURE DECISION: We build the auth middleware interface now,
// even though it's just a placeholder. This means when we integrate Clerk/Auth0,
// we only change THIS file — all routes, controllers, and services remain unchanged.
// The middleware attaches `req.user` to every authenticated request, which is
// the same pattern real auth systems use.
//
// In production: Replace this with JWT verification or Clerk session validation.

const prisma = require("../config/database");

const authMiddleware = async (req, res, next) => {
  try {
    // Check for API key in header (developer API auth pattern, like Vapi uses)
    const apiKey = req.headers["x-api-key"];

    // Check for demo mode header (for frontend testing without API key)
    const isDemoMode =
      req.headers["x-demo-mode"] === "true" || !apiKey;

    if (isDemoMode) {
      // MVP: Use or create a demo user
      let demoUser = await prisma.user.findFirst({
        where: { email: "demo@voiceplatform.dev" },
      });

      if (!demoUser) {
        demoUser = await prisma.user.create({
          data: {
            email: "demo@voiceplatform.dev",
            name: "Demo Developer",
          },
        });
      }

      req.user = demoUser;
      return next();
    }

    // API key auth path
    const user = await prisma.user.findUnique({
      where: { apiKey },
    });

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;