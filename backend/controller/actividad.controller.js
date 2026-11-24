const actividadRepository = require("../repositories/actividad.repository");
const cumplimientoRepository = require("../repositories/cumplimiento.repository");
const proyectoRepository = require("../repositories/proyecto.repository");
const userRepository = require("../repositories/user.repository");
const { normalizeTimezone, currentPeriodKey } = require("../domain/recurrence-calendar");
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

const parseAssigneeId = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El identificador de usuario asignado no es válido",
    );
  }

  return value;
};

const parseCompletionDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La fecha de cumplimiento debe ser una fecha válida en formato YYYY-MM-DD",
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(value.slice(0, 4)) ||
    date.getUTCMonth() + 1 !== Number(value.slice(5, 7)) ||
    date.getUTCDate() !== Number(value.slice(8, 10))
  ) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "La fecha de cumplimiento debe ser una fecha válida en formato YYYY-MM-DD",
    );
  }

  return date.toISOString().slice(0, 10);
};

const normalizeActivity = ({
  titulo,
  descripcion,
  recurrente,
  frecuencia,
  fecha,
  timezone,
}) => ({
  titulo: typeof titulo === "string" ? titulo.trim() : titulo,
  descripcion: descripcion ?? null,
  recurrente: recurrente ?? 0,
  frecuencia: frecuencia ?? null,
  fecha: fecha ?? null,
  zona_horaria: timezone ?? null,
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

  if (actividad.fecha !== null) actividad.fecha = parseCompletionDate(actividad.fecha);
  if (actividad.recurrente === 1 && actividad.fecha === null) throw new ApiError(400, "VALIDATION_ERROR", "Una actividad recurrente requiere fecha de inicio");
  if (actividad.recurrente === 1) {
    actividad.zona_horaria = normalizeTimezone(actividad.zona_horaria);
    if (!actividad.zona_horaria) throw new ApiError(400, "VALIDATION_ERROR", "Una actividad recurrente requiere una zona horaria IANA válida");
  } else if (actividad.zona_horaria !== null) {
    throw new ApiError(400, "VALIDATION_ERROR", "Una actividad no recurrente no debe tener zona horaria");
  }
};

const ensureProjectMembership = async (projectId, userId) => {
  const project = await proyectoRepository.findById(projectId);

  if (!project) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
  }

  const accessibleProject = await proyectoRepository.findAccessibleById(
    projectId,
    userId,
  );

  if (!accessibleProject) {
    throw new ApiError(
      403,
      "PROJECT_FORBIDDEN",
      "No tienes permiso para crear actividades en este proyecto",
    );
  }
};

const ensureProjectCreator = async (projectId, userId) => {
  const project = await proyectoRepository.findById(projectId);

  if (!project) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
  }

  /* Solo quien creó el proyecto puede asignar sus actividades. */
  if (project.creador_id !== userId) {
    throw new ApiError(
      403,
      "PROJECT_FORBIDDEN",
      "No tienes permiso para asignar actividades en este proyecto",
    );
  }

  return project;
};

const ensureProjectAssignee = async (projectId, userId) => {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
  }

  const membership = await proyectoRepository.findAccessibleById(projectId, userId);
  if (!membership) {
    throw new ApiError(
      409,
      "PROJECT_ASSIGNEE_NOT_MEMBER",
      "El usuario asignado debe pertenecer al proyecto",
    );
  }
};

const createActivity = async (req, res, next) => {
  try {
    const actividad = normalizeActivity(req.body ?? {});
    const projectId = req.body?.proyecto_id ?? req.body?.proyectoId ?? null;
    const assigneeId = req.body?.asignado_usuario_id ?? req.body?.asignadoUsuarioId ?? null;

    validateActivity(actividad);

    if (projectId !== null) {
      await ensureProjectMembership(projectId, req.user.id);

      if (assigneeId !== null) {
        await ensureProjectCreator(projectId, req.user.id);
        await ensureProjectAssignee(projectId, parseAssigneeId(assigneeId));
      }
    } else if (assigneeId !== null) {
      throw new ApiError(
        409,
        "PERSONAL_ACTIVITY_CANNOT_BE_ASSIGNED",
        "Las actividades personales no pueden asignarse",
      );
    }

    const activityId = await actividadRepository.create({
      ...actividad,
      usuario_id: req.user.id,
      proyecto_id: projectId,
      asignado_usuario_id: assigneeId === null ? null : parseAssigneeId(assigneeId),
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

const updateActivityAssignment = async (req, res, next) => {
  try {
    const activityId = parseActivityId(req.params.id);

    if (!Object.hasOwn(req.body ?? {}, "asignadoUsuarioId")) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "El campo asignadoUsuarioId es obligatorio",
      );
    }

    const assigneeValue = req.body.asignadoUsuarioId;
    const assigneeId = assigneeValue === null
      ? null
      : parseAssigneeId(assigneeValue);
    const activity = await actividadRepository.findByIdForAssignment(activityId);

    if (!activity) {
      throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Actividad no encontrada");
    }

    if (activity.proyecto_id === null) {
      throw new ApiError(
        409,
        "PERSONAL_ACTIVITY_CANNOT_BE_ASSIGNED",
        "Las actividades personales no pueden asignarse",
      );
    }

    await ensureProjectCreator(activity.proyecto_id, req.user.id);

    if (assigneeId !== null) {
      await ensureProjectAssignee(activity.proyecto_id, assigneeId);
    }

    const result = await actividadRepository.updateAssignment(
      activityId,
      activity.proyecto_id,
      req.user.id,
      assigneeId,
    );

    if (result.changes === 0) {
      throw new ApiError(
        409,
        "ASSIGNMENT_CONFLICT",
        "La asignación cambió antes de poder actualizarse",
      );
    }

    const updatedActivity = await actividadRepository.findByIdForAssignment(activityId);

    return res.status(200).json({
      mensaje: "Asignación de actividad actualizada correctamente",
      actividad: updatedActivity,
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

const getActivity = async (req, res, next) =>{
  try {
    const activityId = parseActivityId(req.params.id);

    const actividad = await actividadRepository.findAccessibleById(
      activityId,
      req.user.id,
    );
    if(!actividad){
      throw new ApiError(
        404,
        "ACTIVITY_NOT_FOUND",
        "Actividad no encontrada",
      );
    }
    return res.status(200).json({ actividad });
  }catch (error) {
    return next(error);
  }
}


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
      timezone = existingActivity.zona_horaria,
    } = req.body ?? {};

    const actividad = normalizeActivity({
      titulo,
      descripcion,
      recurrente,
      frecuencia,
      fecha,
      timezone,
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

const completeActivity = async (req, res, next) => {
  let activityId;

  try {
    activityId = parseActivityId(req.params.id);

    const activity = await actividadRepository.findAccessibleById(
      activityId,
      req.user.id,
    );

    if (!activity) {
      throw new ApiError(
        404,
        "ACTIVITY_NOT_FOUND",
        "Actividad no encontrada",
      );
    }

    // Las recurrencias usan exclusivamente su calendario local configurado.
    const fecha = Object.hasOwn(req.body ?? {}, "fecha")
      ? parseCompletionDate(req.body.fecha)
      : activity.recurrente === 1 ? currentPeriodKey(activity.frecuencia, activity.zona_horaria || "UTC") : activity.fecha ?? new Date().toISOString().slice(0, 10);

    if (activity.estado !== "pendiente") {
      const cumplimiento = await cumplimientoRepository.findByActivityId(
        activityId,
        req.user.id,
      );

      if (cumplimiento) {
        return res.status(200).json({
          mensaje: "Actividad ya completada",
          cumplimiento,
        });
      }

      throw new ApiError(
        409,
        "ACTIVITY_ALREADY_COMPLETED",
        "La actividad ya fue completada",
      );
    }

    // Una actividad no recurrente programada solo puede cumplirse en su fecha prevista.
    if (activity.recurrente === 0 && activity.fecha !== null && activity.fecha !== fecha) {
      throw new ApiError(
        409,
        "ACTIVITY_NOT_SCHEDULED_FOR_DATE",
        "La actividad no está programada para la fecha de cumplimiento indicada",
      );
    }

    const cumplimiento = await cumplimientoRepository.registrarCumplimiento(
      activityId,
      req.user.id,
      fecha,
      activity.fecha,
      activity.recurrente,
      activity.frecuencia,
    );

    return res.status(cumplimiento.idempotent ? 200 : 201).json({
      mensaje: "Actividad completada correctamente",
      cumplimiento,
    });
  } catch (error) {
    if (error.code === "ACTIVITY_ALREADY_COMPLETED") {
      const cumplimiento = await cumplimientoRepository.findByActivityId(
        activityId,
        req.user.id,
      );

      if (cumplimiento) {
        return res.status(200).json({
          mensaje: "Actividad ya completada",
          cumplimiento,
        });
      }

      return next(
        new ApiError(
          409,
          "ACTIVITY_ALREADY_COMPLETED",
          "La actividad ya fue completada",
        ),
      );
    }

    if (error.code === "ACTIVITY_NOT_ELIGIBLE") {
      return next(
        new ApiError(
          409,
          "ACTIVITY_COMPLETION_CONFLICT",
          "La actividad cambió antes de poder completarse",
        ),
      );
    }

    if (error.code === "ACTIVITY_NOT_STARTED") {
      return next(
        new ApiError(
          409,
          "ACTIVITY_NOT_STARTED",
          "La actividad todavía no comenzó",
        ),
      );
    }

    return next(error);
  }
};

module.exports = {
  createActivity,
  updateActivityAssignment,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
};
