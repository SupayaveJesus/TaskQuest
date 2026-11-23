const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
} = require("../controller/proyecto.controller");

const router = express.Router();

router.use(authenticateToken);
router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id/miembros", getProjectMembers);
router.post("/:id/miembros", addProjectMember);
router.delete("/:id/miembros/:usuarioId", removeProjectMember);
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

module.exports = router;
