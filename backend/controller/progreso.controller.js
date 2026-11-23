const progresoRepository = require("../repositories/progreso.repository");
const { ApiError } = require("../middleware/error.middleware");

const parseAsOf = (value) => {
  if (value === undefined) return new Date();
  if (typeof value !== "string") throw new ApiError(400, "VALIDATION_ERROR", "asOf debe ser una fecha o timestamp ISO válido");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "VALIDATION_ERROR", "asOf debe ser una fecha o timestamp ISO válido");
  return date;
};

const getPersonalProgress = async (req, res, next) => {
  try { return res.status(200).json(await progresoRepository.personalProgress(req.user.id, parseAsOf(req.query.asOf))); } catch (error) { return next(error); }
};
const getProjectProgress = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "VALIDATION_ERROR", "El identificador de proyecto no es válido");
    const progress = await progresoRepository.projectProgress(id, req.user.id, parseAsOf(req.query.asOf));
    if (!progress) throw new ApiError(403, "PROJECT_FORBIDDEN", "No tienes acceso a este proyecto");
    return res.status(200).json(progress);
  } catch (error) { return next(error); }
};

module.exports = { getPersonalProgress, getProjectProgress };
