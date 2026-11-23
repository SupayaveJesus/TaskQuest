const db = require("../config/database");
const { opportunitiesThrough } = require("../domain/recurrence-calendar");

const accessibleActivities = (userId, projectId = null) => db.allAsync(
  `SELECT a.* FROM actividades a WHERE ${projectId === null
    ? "((a.proyecto_id IS NULL AND (a.usuario_id = ? OR a.asignado_usuario_id = ?)) OR (a.proyecto_id IS NOT NULL AND EXISTS (SELECT 1 FROM proyecto_usuarios pu WHERE pu.proyecto_id = a.proyecto_id AND pu.usuario_id = ?)))"
    : "a.proyecto_id = ? AND EXISTS (SELECT 1 FROM proyecto_usuarios pu WHERE pu.proyecto_id = a.proyecto_id AND pu.usuario_id = ?)"}`,
  projectId === null ? [userId, userId, userId] : [projectId, userId],
);

const aggregate = async (userId, asOf, projectId = null) => {
  const activities = await accessibleActivities(userId, projectId);
  const completionRows = projectId === null
    ? await db.allAsync("SELECT actividad_id, fecha FROM actividad_cumplimientos WHERE actor_usuario_id = ?", [userId])
    : await db.allAsync("SELECT c.actividad_id, c.fecha FROM actividad_cumplimientos c JOIN actividades a ON a.id = c.actividad_id WHERE a.proyecto_id = ?", [projectId]);
  const completions = new Set(completionRows.map((row) => `${row.actividad_id}:${row.fecha}`));
  let eligible = 0;
  let completed = 0;
  const activitiesSummary = activities.map((activity) => {
    const opportunities = opportunitiesThrough(activity, asOf);
    const done = opportunities.filter((date) => completions.has(`${activity.id}:${date}`)).length;
    eligible += opportunities.length;
    completed += done;
    return {
      activityId: activity.id,
      projectId: activity.proyecto_id,
      title: activity.titulo,
      eligible: opportunities.length,
      completed: done,
      rate: opportunities.length ? done / opportunities.length : 0,
      completionRate: opportunities.length ? done / opportunities.length : 0,
      recurrence: activity.recurrente ? { frequency: activity.frecuencia, timezone: activity.zona_horaria } : null,
    };
  });
  const rate = eligible ? completed / eligible : 0;
  return { asOf: new Date(asOf).toISOString(), completed, eligible, rate, completionRate: rate, activities: activitiesSummary };
};

const personalProgress = async (userId, asOf = new Date()) => {
  const summary = await aggregate(userId, asOf);
  const xp = (await db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [userId]))?.puntos ?? 0;
  const byDate = await db.allAsync("SELECT fecha AS date, COUNT(*) AS completed, SUM(puntos) AS xp FROM actividad_cumplimientos WHERE actor_usuario_id = ? GROUP BY fecha ORDER BY fecha", [userId]);
  return { ...summary, xp, byDate };
};

const projectProgress = async (projectId, userId, asOf = new Date()) => {
  const project = await db.getAsync("SELECT p.id, p.nombre FROM proyectos p JOIN proyecto_usuarios pu ON pu.proyecto_id = p.id WHERE p.id = ? AND pu.usuario_id = ?", [projectId, userId]);
  return project ? { ...(await aggregate(userId, asOf, projectId)), project } : null;
};

module.exports = { personalProgress, projectProgress };
