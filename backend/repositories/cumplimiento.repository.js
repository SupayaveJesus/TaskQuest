const db = require("../config/database");
const { currentPeriodKey, monday } = require("../domain/recurrence-calendar");

const XP_PER_COMPLETION = 10;

const repositoryError = (code, message) => Object.assign(new Error(message), { code });

const findByActivityId = (actividadId, usuarioId, fecha = null) => db.getAsync(
  `SELECT c.actividad_id AS actividadId, c.fecha, c.puntos AS puntosGanados,
          u.puntos AS puntosTotales
   FROM actividad_cumplimientos c JOIN usuarios u ON u.id = c.actor_usuario_id
   WHERE c.actividad_id = ? AND c.actor_usuario_id = ? ${fecha ? "AND c.fecha = ?" : ""}
   ORDER BY c.id DESC LIMIT 1`,
  fecha ? [actividadId, usuarioId, fecha] : [actividadId, usuarioId],
);

const registrarCumplimiento = async (
  actividadId,
  usuarioId,
  fecha,
  fechaProgramada,
  recurrente = 0,
  frecuencia = null,
) => {
  return db.withTransaction(async () => {
    const activity = await db.getAsync(
      `SELECT a.* FROM actividades a
       WHERE a.id = ? AND (
         (a.proyecto_id IS NULL AND (a.usuario_id = ? OR a.asignado_usuario_id = ?))
         OR (a.proyecto_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM proyecto_usuarios pu WHERE pu.proyecto_id = a.proyecto_id AND pu.usuario_id = ?
         ))
       )`,
      [actividadId, usuarioId, usuarioId, usuarioId],
    );
    if (!activity) throw repositoryError("ACTIVITY_NOT_ELIGIBLE", "La actividad no puede completarse");
    if (activity.proyecto_id && activity.usuario_id !== usuarioId && activity.asignado_usuario_id !== usuarioId) {
      throw repositoryError("ACTIVITY_NOT_ELIGIBLE", "La actividad no puede completarse");
    }

    const occurrenceDate = activity.recurrente ? currentPeriodKey(activity.frecuencia, activity.zona_horaria || "UTC") : fecha;
    if (activity.recurrente && fecha !== occurrenceDate) {
      throw repositoryError("ACTIVITY_NOT_ELIGIBLE", "Solo puede completarse la ocurrencia local actual");
    }
    if (activity.recurrente) {
      const startPeriod = activity.frecuencia === "semanal"
        ? monday(activity.fecha)
        : activity.fecha;

      if (occurrenceDate < startPeriod) {
        throw repositoryError("ACTIVITY_NOT_STARTED", "La actividad recurrente todavía no comenzó");
      }
    }
    if (
      !activity.recurrente
      && activity.fecha !== null
      && activity.fecha > new Date().toISOString().slice(0, 10)
    ) {
      throw repositoryError("ACTIVITY_NOT_STARTED", "La actividad todavía no comenzó");
    }
    if (!activity.recurrente && activity.estado !== "pendiente") {
      const existing = await findByActivityId(actividadId, usuarioId);
      if (existing) return { ...existing, idempotent: true };
      throw repositoryError("ACTIVITY_ALREADY_COMPLETED", "La actividad ya fue completada");
    }

    const existing = await findByActivityId(actividadId, usuarioId, occurrenceDate);
    if (existing) return { ...existing, idempotent: true };
    if (activity.recurrente) {
      await db.runAsync(
        "INSERT INTO actividad_ocurrencias (actividad_id, fecha, estado) VALUES (?, ?, 'pendiente') ON CONFLICT(actividad_id, fecha) DO NOTHING",
        [actividadId, occurrenceDate],
      );
      const changed = await db.runAsync(
        "UPDATE actividad_ocurrencias SET estado = 'completada', completada_por_usuario_id = ?, completada_en = CURRENT_TIMESTAMP WHERE actividad_id = ? AND fecha = ? AND estado = 'pendiente'",
        [usuarioId, actividadId, occurrenceDate],
      );
      if (!changed.changes) throw repositoryError("ACTIVITY_ALREADY_COMPLETED", "La ocurrencia ya fue completada");
    } else {
      const changed = await db.runAsync(
        "UPDATE actividades SET estado = 'completada' WHERE id = ? AND estado = 'pendiente' AND recurrente = 0 AND (fecha = ? OR (fecha IS NULL AND ? IS NULL))",
        [actividadId, fechaProgramada, fechaProgramada],
      );
      if (!changed.changes) throw repositoryError("ACTIVITY_NOT_ELIGIBLE", "La actividad no puede completarse");
    }
    await db.runAsync(
      "INSERT INTO actividad_cumplimientos (actividad_id, actor_usuario_id, fecha, puntos) VALUES (?, ?, ?, ?)",
      [actividadId, usuarioId, occurrenceDate, XP_PER_COMPLETION],
    );
    await db.runAsync("UPDATE usuarios SET puntos = puntos + ? WHERE id = ?", [XP_PER_COMPLETION, usuarioId]);
    const user = await db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [usuarioId]);
    return { actividadId, fecha: occurrenceDate, timezone: activity.recurrente ? activity.zona_horaria || "UTC" : null, puntosGanados: XP_PER_COMPLETION, puntosTotales: user.puntos, idempotent: false };
  });
};

module.exports = { findByActivityId, registrarCumplimiento };
