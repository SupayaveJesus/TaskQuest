const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const actividadRoutes = require("./routes/actividad.routes");
const { ApiError, errorHandler } = require("./middleware/error.middleware");

function configuredOrigins(value = process.env.CORS_ORIGIN) {
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("CORS_ORIGIN must be configured in production");
  }
  const origins = (value || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && origins.includes("*")) {
    throw new Error("CORS_ORIGIN cannot use a wildcard in production");
  }
  return new Set(origins);
}

function createApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET must be configured with at least 16 characters");
  }
  const origins = configuredOrigins();
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      return callback(new ApiError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed"));
    },
  }));
  app.use(express.json());
  app.get("/", (req, res) => res.json({ mensaje: "API de TaskQuest funcionando correctamente" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/actividades", actividadRoutes);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
