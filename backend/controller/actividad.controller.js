const actividadRepository = require("../repositories/actividad.repository");

// Crear actividad
const createActivity = async (req, res) => {
  try {
    const { titulo, descripcion, recurrente, frecuencia, fecha, proyecto_id } =
      req.body;

    if (typeof titulo !== "string" || !titulo.trim()) {
      return res.status(400).json({
        mensaje: "El título es obligatorio",
      });
    }

    const userId = req.user.id;

    const activityId = await actividadRepository.create({
      titulo: titulo.trim(),
      descripcion,
      recurrente,
      frecuencia,
      fecha,
      usuario_id: userId,
      proyecto_id,
    });

    return res.status(201).json({
      mensaje: "Actividad creada correctamente",
      actividad: await actividadRepository.findById(activityId, userId),
    });
  } catch (error) {
    console.error("Error al crear actividad:", error);

    return res.status(500).json({
      mensaje: "Error interno del servidor",
    });
  }
};

// Listar actividades
const getActivities = async (req, res) => {
  try {
    const userId = req.user.id;

    const actividades = await actividadRepository.findByUser(userId);

    return res.status(200).json({
      actividades,
    });
  } catch (error) {
    console.error("Error al obtener actividades:", error);

    return res.status(500).json({
      mensaje: "Error interno del servidor",
    });
  }
};

const updateActivity = async (req, res) => {
  try {
    const activityId = req.params.id;
    const userId = req.user.id;

    // Buscar actividad existente
    const actividad = await actividadRepository.findById(activityId, userId);

    if (!actividad) {
      return res.status(404).json({
        mensaje: "Actividad no encontrada",
      });
    }

    // Obtener datos enviados
    const {
      titulo = actividad.titulo,
      descripcion = actividad.descripcion,
      recurrente = actividad.recurrente,
      frecuencia = actividad.frecuencia,
      fecha = actividad.fecha,
    } = req.body;

    // Validar datos
    if (
      typeof titulo !== "string" ||
      !titulo.trim() ||
      ![0, 1].includes(recurrente) ||
      (frecuencia !== null && !["diaria", "semanal"].includes(frecuencia))
    ) {
      return res.status(400).json({
        mensaje: "Datos de actividad inválidos",
      });
    }

    // Actualizar
    await actividadRepository.update(activityId, userId, {
      titulo: titulo.trim(),
      descripcion,
      recurrente,
      frecuencia,
      fecha,
    });

    return res.status(200).json({
      mensaje: "Actividad actualizada correctamente",
      actividad: await actividadRepository.findById(activityId, userId),
    });
  } catch (error) {
    console.error("Error al actualizar actividad:", error);

    return res.status(500).json({
      mensaje: "Error interno del servidor",
    });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const activityId = req.params.id;
    const userId = req.user.id;

    const changes = await actividadRepository.remove(activityId, userId);

    if (changes === 0) {
      return res.status(404).json({
        mensaje: "Actividad no encontrada",
      });
    }

    return res.status(200).json({
      mensaje: "Actividad eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar actividad:", error);

    return res.status(500).json({
      mensaje: "Error interno del servidor",
    });
  }
};

module.exports = {
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
};
