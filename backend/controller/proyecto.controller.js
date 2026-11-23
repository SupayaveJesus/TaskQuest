const proyectoRepository = require("../repositories/proyecto.repository");
const userRepository = require("../repositories/user.repository");
const { ApiError } = require("../middleware/error.middleware");

const parseProjectId = (value) => {
  const projectId = Number(value);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador de proyecto no es válido",
    );
  }

  return projectId;
};

const parseUserId = (value) => {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador de usuario no es válido",
    );
  }

  return userId;
};

const validateProject = (body) => {
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const descripcion = body?.descripcion ?? null;

  if (!nombre) {
    throw new ApiError(400, "VALIDATION_ERROR", "El nombre es obligatorio");
  }

  if (descripcion !== null && typeof descripcion !== "string") {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La descripción debe ser texto",
    );
  }

  return { nombre, descripcion };
};

const mapOutcome = (outcome) => {
  if (outcome === "NOT_FOUND") throw new ApiError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
  if (outcome === "FORBIDDEN") throw new ApiError(403, "PROJECT_FORBIDDEN", "No tienes permiso para modificar este proyecto");
  if (outcome === "CONFLICT") throw new ApiError(409, "PROJECT_MEMBER_ALREADY_EXISTS", "El usuario ya pertenece al proyecto");
  if (outcome === "USER_NOT_FOUND") throw new ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
  if (outcome === "CREATOR_REQUIRED") throw new ApiError(409, "PROJECT_CREATOR_MEMBERSHIP_REQUIRED", "No se puede eliminar al creador del proyecto");
  if (outcome === "MEMBER_NOT_FOUND") throw new ApiError(404, "PROJECT_MEMBER_NOT_FOUND", "El usuario no es miembro del proyecto");
};

const createProject = async (req, res, next) => {
  try {
    const projectData = validateProject(req.body);
    const projectId = await proyectoRepository.create({
      ...projectData,
      creadorId: req.user.id,
    });
    const proyecto = await proyectoRepository.findAccessibleById(projectId, req.user.id);

    return res.status(201).json({ proyecto });
  } catch (error) {
    return next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const proyectos = await proyectoRepository.findAccessibleByUser(req.user.id);

    return res.status(200).json({ proyectos });
  } catch (error) {
    return next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const proyecto = await proyectoRepository.findAccessibleById(projectId, req.user.id);

    if (!proyecto) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
    }

    return res.status(200).json({ proyecto });
  } catch (error) {
    return next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const projectData = validateProject(req.body);
    const result = await proyectoRepository.update(projectId, req.user.id, projectData);
    mapOutcome(result.outcome);
    const proyecto = await proyectoRepository.findAccessibleById(projectId, req.user.id);

    return res.status(200).json({ proyecto });
  } catch (error) {
    return next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const result = await proyectoRepository.remove(projectId, req.user.id);
    mapOutcome(result.outcome);

    return res.status(200).json({ mensaje: "Proyecto eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

const getProjectMembers = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const project = await proyectoRepository.findById(projectId);
    if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
    if (project.creador_id !== req.user.id) throw new ApiError(403, "PROJECT_FORBIDDEN", "No tienes permiso para modificar este proyecto");
    const miembros = await proyectoRepository.findMembersByProjectId(projectId);

    return res.status(200).json({ miembros });
  } catch (error) {
    return next(error);
  }
};

const addProjectMember = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const usuarioId = parseUserId(req.body?.usuarioId);
    const result = await proyectoRepository.addMember(projectId, req.user.id, usuarioId);
    mapOutcome(result.outcome);
    const usuario = await userRepository.findById(usuarioId);

    return res.status(201).json({ miembro: usuario });
  } catch (error) {
    return next(error);
  }
};

const removeProjectMember = async (req, res, next) => {
  try {
    const projectId = parseProjectId(req.params.id);
    const usuarioId = parseUserId(req.params.usuarioId);
    const result = await proyectoRepository.removeMember(projectId, req.user.id, usuarioId);
    mapOutcome(result.outcome);

    return res.status(200).json({ mensaje: "Miembro eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
};
