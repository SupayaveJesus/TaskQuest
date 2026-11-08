const actividadRepository = require("../repositories/actividad.repository");
const { ApiError } = require("../middleware/error.middleware");

const ALLOWED_FREQUENCIES = ["diaria", "semanal"];

const parseActivityId = (value) => {
  const activityId = Number(value);

  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador de actividad no es válido",
    );
  }

  return activityId;
};

const normalizeActivity = ({
  titulo,
  descripcion,
  recurrente,
  frecuencia,
  fecha,
}) => ({
  titulo: typeof titulo === "string" ? titulo.trim() : titulo,
  descripcion: descripcion ?? null,
  recurrente: recurrente ?? 0,
  frecuencia: frecuencia ?? null,
  fecha: fecha ?? null,
});

const validateActivity = (actividad) => {
  if (typeof actividad.titulo !== "string" || !actividad.titulo) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El título es obligatorio",
    );
  }

  if (![0, 1].includes(actividad.recurrente)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El campo recurrente debe ser 0 o 1",
    );
  }

  if (
    actividad.recurrente === 1 &&
    !ALLOWED_FREQUENCIES.includes(actividad.frecuencia)
  ) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Una actividad recurrente debe tener frecuencia diaria o semanal",
    );
  }

  if (actividad.recurrente === 0 && actividad.frecuencia !== null) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Una actividad no recurrente no debe tener frecuencia",
    );
  }

  if (
    actividad.descripcion !== null &&
    typeof actividad.descripcion !== "string"
  ) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La descripción debe ser texto",
    );
  }

  if (actividad.fecha !== null && typeof actividad.fecha !== "string") {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La fecha debe ser texto",
    );
  }
};

const createActivity = async (req, res, next) => {
  try {
    const actividad = normalizeActivity(req.body ?? {});

    validateActivity(actividad);

    const activityId = await actividadRepository.create({
      ...actividad,
      usuario_id: req.user.id,
      proyecto_id: req.body?.proyecto_id ?? null,
    });

    const createdActivity = await actividadRepository.findById(
      activityId,
      req.user.id,
    );

    return res.status(201).json({
      mensaje: "Actividad creada correctamente",
      actividad: createdActivity,
    });
  } catch (error) {
    return next(error);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const actividades = await actividadRepository.findByUser(req.user.id);

    return res.status(200).json({ actividades });
  } catch (error) {
    return next(error);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    const activityId = parseActivityId(req.params.id);

    const existingActivity = await actividadRepository.findById(
      activityId,
      req.user.id,
    );

    if (!existingActivity) {
      throw new ApiError(
        404,
        "ACTIVITY_NOT_FOUND",
        "Actividad no encontrada",
      );
    }

    const {
      titulo = existingActivity.titulo,
      descripcion = existingActivity.descripcion,
      recurrente = existingActivity.recurrente,
      frecuencia = existingActivity.frecuencia,
      fecha = existingActivity.fecha,
    } = req.body ?? {};

    const actividad = normalizeActivity({
      titulo,
      descripcion,
      recurrente,
      frecuencia,
      fecha,
    });

    validateActivity(actividad);

    await actividadRepository.update(activityId, req.user.id, actividad);

    const updatedActivity = await actividadRepository.findById(
      activityId,
      req.user.id,
    );

    return res.status(200).json({
      mensaje: "Actividad actualizada correctamente",
      actividad: updatedActivity,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    const activityId = parseActivityId(req.params.id);

    const changes = await actividadRepository.remove(activityId, req.user.id);

    if (changes === 0) {
      throw new ApiError(
        404,
        "ACTIVITY_NOT_FOUND",
        "Actividad no encontrada",
      );
    }

    return res.status(200).json({
      mensaje: "Actividad eliminada correctamente",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
};