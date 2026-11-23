async function up(db) {
  const columns = await db.allAsync("PRAGMA table_info(actividades)");
  const names = new Set(columns.map(({ name }) => name));
  if (!names.has("estado")) await db.runAsync("ALTER TABLE actividades ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'");
  if (!names.has("recurrente")) await db.runAsync("ALTER TABLE actividades ADD COLUMN recurrente INTEGER NOT NULL DEFAULT 0");
  if (!names.has("frecuencia")) await db.runAsync("ALTER TABLE actividades ADD COLUMN frecuencia TEXT");
  if (!names.has("fecha")) await db.runAsync("ALTER TABLE actividades ADD COLUMN fecha TEXT");
  if (!names.has("proyecto_id")) await db.runAsync("ALTER TABLE actividades ADD COLUMN proyecto_id INTEGER REFERENCES proyectos(id)");
  const invalid = await db.getAsync(`SELECT id FROM actividades
    WHERE estado NOT IN ('pendiente', 'completada')
       OR recurrente NOT IN (0, 1)
       OR (recurrente = 1 AND (frecuencia NOT IN ('diaria', 'semanal') OR fecha IS NULL OR fecha NOT GLOB '????-??-??'))
       OR (recurrente = 0 AND frecuencia IS NOT NULL)
    LIMIT 1`);
  if (invalid) throw new Error(`Cannot migrate recurrence opportunities: activity ${invalid.id} is invalid; repair legacy data before retrying`);
  await db.runAsync(`CREATE TABLE actividad_ocurrencias (
    actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL CHECK(fecha GLOB '????-??-??'),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'completada')),
    completada_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    completada_en TEXT,
    PRIMARY KEY (actividad_id, fecha)
  )`);
  await db.runAsync("CREATE INDEX idx_ocurrencias_fecha ON actividad_ocurrencias(fecha)");
  await db.runAsync("CREATE INDEX idx_actividades_proyecto ON actividades(proyecto_id)");
}

module.exports = { up };
