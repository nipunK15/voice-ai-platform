// middleware/errorHandler.js
// Centralized error handling middleware.
// Express catches errors thrown in route handlers and passes them here.
// Having one error format across the entire API makes frontend error handling
// predictable and consistent — critical for a developer platform.

const errorHandler = (err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Prisma-specific errors
  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Conflict",
      message: "A record with this value already exists",
      field: err.meta?.target,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Not Found",
      message: "Record not found",
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
      details: err.details,
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || "Internal Server Error",
    message: err.message || "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;