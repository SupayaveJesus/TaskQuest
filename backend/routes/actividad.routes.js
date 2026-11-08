const express = require("express");
const router = express.Router();

const {
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
} = require("../controller/actividad.controller");

const authenticateToken = require("../middleware/auth.middleware");

// Proteger todas las rutas
router.use(authenticateToken);

// Actividades
router.post("/", createActivity);
router.get("/", getActivities);
router.put("/:id", updateActivity);
router.delete("/:id", deleteActivity);

module.exports = router;
