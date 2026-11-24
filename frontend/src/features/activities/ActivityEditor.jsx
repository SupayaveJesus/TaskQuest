import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  updateActivity,
  updateActivityAssignment,
} from "./activitiesSlice";
import { fetchProjectMembers } from "../projects/projectsSlice";

const FREQUENCIES = ["diaria", "semanal"];

function formFor(activity) {
  return {
    titulo: activity.titulo,
    descripcion: activity.descripcion ?? "",
    recurrente: String(activity.recurrente),
    frecuencia: activity.frecuencia ?? "",
    fecha: activity.fecha ?? "",
    timezone: activity.zona_horaria ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  };
}

export default function ActivityEditor({ activity, canAssign, canEdit, deleteAction }) {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => formFor(activity));
  const [validationError, setValidationError] = useState(null);
  const {
    updateStatusById,
    updateErrorById,
    assignmentStatusById,
    assignmentErrorById,
  } = useSelector((state) => state.activities);
  const {
    membersByProjectId,
    memberListStatusByProjectId,
    memberListErrorByProjectId,
  } = useSelector((state) => state.projects);
  const projectId = activity.proyecto_id;
  const members = projectId ? membersByProjectId[projectId] ?? [] : [];
  const membersStatus = projectId ? memberListStatusByProjectId[projectId] ?? "idle" : "idle";

  useEffect(() => {
    if (canAssign && membersStatus === "idle") {
      dispatch(fetchProjectMembers(projectId));
    }
  }, [canAssign, dispatch, membersStatus, projectId]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValidationError(null);
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const recurrente = form.recurrente === "1";
    if (recurrente && (!FREQUENCIES.includes(form.frecuencia) || !form.fecha || !form.timezone.trim())) {
      setValidationError("Completá frecuencia, fecha inicial y zona horaria para la recurrencia.");
      return;
    }

    const action = await dispatch(updateActivity({
      activityId: activity.id,
      activity: {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        recurrente: recurrente ? 1 : 0,
        frecuencia: recurrente ? form.frecuencia : null,
        fecha: form.fecha || null,
        timezone: recurrente ? form.timezone.trim() : null,
      },
    }));

    if (updateActivity.fulfilled.match(action)) setIsEditing(false);
  }

  function handleAssignment(event) {
    const value = event.target.value;
    dispatch(updateActivityAssignment({
      activityId: activity.id,
      asignadoUsuarioId: value ? Number(value) : null,
    }));
  }

  const isSaving = updateStatusById[activity.id] === "loading";
  const isAssigning = assignmentStatusById[activity.id] === "loading";

  return (
    <div className="activity-editor">
      {canEdit && (
        <button
          className="activity-card__secondary"
          onClick={() => {
            setForm(formFor(activity));
            setValidationError(null);
            setIsEditing((current) => !current);
          }}
          type="button"
        >
          {isEditing ? "Cancelar edición" : "Editar"}
        </button>
      )}

      {deleteAction}

      {canEdit && isEditing && (
        <form className="activity-editor__form" onSubmit={handleSubmit}>
          <label>
            Título
            <input name="titulo" onChange={handleChange} required value={form.titulo} />
          </label>
          <label>
            Descripción
            <textarea name="descripcion" onChange={handleChange} value={form.descripcion} />
          </label>
          <fieldset>
            <legend>Tipo</legend>
            <label><input checked={form.recurrente === "0"} name="recurrente" onChange={handleChange} type="radio" value="0" /> Una vez</label>
            <label><input checked={form.recurrente === "1"} name="recurrente" onChange={handleChange} type="radio" value="1" /> Recurrente</label>
          </fieldset>
          <label>
            {form.recurrente === "1" ? "Fecha inicial" : "Fecha programada"}
            <input name="fecha" onChange={handleChange} required={form.recurrente === "1"} type="date" value={form.fecha} />
          </label>
          {form.recurrente === "1" && (
            <>
              <label>
                Frecuencia
                <select name="frecuencia" onChange={handleChange} required value={form.frecuencia}>
                  <option value="">Elegí una frecuencia</option>
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                </select>
              </label>
              <label>
                Zona horaria
                <input name="timezone" onChange={handleChange} required value={form.timezone} />
              </label>
            </>
          )}
          <p className="activity-editor__preserved">El proyecto y la asignación actual se conservan al editar.</p>
          {validationError && <p role="alert">{validationError}</p>}
          {updateErrorById[activity.id] && <p role="alert">{updateErrorById[activity.id]}</p>}
          <button disabled={isSaving} type="submit">{isSaving ? "Guardando..." : "Guardar cambios"}</button>
        </form>
      )}

      {canAssign && (
        <label className="activity-editor__assignment">
          Asignar a
          <select
            disabled={membersStatus !== "succeeded" || isAssigning}
            onChange={handleAssignment}
            value={activity.asignado_usuario_id ?? ""}
          >
            <option value="">{membersStatus === "loading" ? "Cargando miembros..." : "Sin asignar"}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}
          </select>
          {memberListErrorByProjectId[projectId] && <small role="alert">No se pudieron cargar los miembros.</small>}
          {membersStatus === "failed" && (
            <button onClick={() => dispatch(fetchProjectMembers(projectId))} type="button">
              Reintentar miembros
            </button>
          )}
          {assignmentErrorById[activity.id] && <small role="alert">{assignmentErrorById[activity.id]}</small>}
        </label>
      )}
    </div>
  );
}
