const { normalizeTimezone } = require("../../domain/recurrence-calendar");

async function up(db) {
  const columns = await db.allAsync("PRAGMA table_info(actividades)");
  if (!columns.some(({ name }) => name === "zona_horaria")) {
    await db.runAsync("ALTER TABLE actividades ADD COLUMN zona_horaria TEXT");
  }

  const invalid = await db.getAsync(`SELECT id FROM actividades
    WHERE recurrente = 1 AND (frecuencia NOT IN ('diaria', 'semanal') OR fecha IS NULL)
    LIMIT 1`);
  if (invalid) throw new Error(`Cannot migrate activity timezones: activity ${invalid.id} is not a valid recurrent activity`);

  const configuredTimezones = await db.allAsync(`SELECT id, zona_horaria FROM actividades
    WHERE recurrente = 1 AND zona_horaria IS NOT NULL`);
  for (const activity of configuredTimezones) {
    const timezone = normalizeTimezone(activity.zona_horaria);
    if (!timezone) throw new Error(`Cannot migrate activity timezones: activity ${activity.id} has an invalid timezone`);
    if (timezone !== activity.zona_horaria) {
      await db.runAsync("UPDATE actividades SET zona_horaria = ? WHERE id = ?", [timezone, activity.id]);
    }
  }

  await db.runAsync("UPDATE actividades SET zona_horaria = 'UTC' WHERE recurrente = 1 AND zona_horaria IS NULL");
  const malformed = await db.getAsync("SELECT id, zona_horaria FROM actividades WHERE recurrente = 1 AND (zona_horaria IS NULL OR trim(zona_horaria) = '') LIMIT 1");
  if (malformed) throw new Error(`Cannot migrate activity timezones: activity ${malformed.id} has an invalid timezone`);
  await db.runAsync("CREATE INDEX IF NOT EXISTS idx_actividades_zona_horaria ON actividades(zona_horaria)");
}

module.exports = { up };
