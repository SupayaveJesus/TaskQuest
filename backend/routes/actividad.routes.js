const express = require("express");
const router = express.Router();

const {
  createActivity,
  updateActivityAssignment,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
} = require("../controller/actividad.controller");

const authenticateToken = require("../middleware/auth.middleware");

// Proteger todas las rutas
router.use(authenticateToken);

// Actividades
router.post("/", createActivity);
router.get("/", getActivities);
router.get("/:id", getActivity);
router.patch("/:id/asignacion", updateActivityAssignment);
router.put("/:id", updateActivity);
router.delete("/:id", deleteActivity);
router.post("/:id/cumplimientos", completeActivity);

module.exports = router;