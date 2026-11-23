const express = require("express");
const router = express.Router();

const { getPersonalProgress, getProjectProgress } = require("../controller/progreso.controller");
const authenticateMiddleware = require("../middleware/auth.middleware");

router.get("/personal", authenticateMiddleware, getPersonalProgress);
router.get("/proyectos/:id", authenticateMiddleware, getProjectProgress);

module.exports = router;
