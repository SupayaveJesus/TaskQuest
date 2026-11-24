import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { createActivity } from "./activitiesSlice";
import {
  fetchProjectMembers,
  fetchProjects,
} from "../projects/projectsSlice";

const FREQUENCIES = ["diaria", "semanal"];

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function createInitialForm() {
  return {
    titulo: "",
    descripcion: "",
    fecha: "",
    recurrente: "0",
    frecuencia: "",
    timezone: getBrowserTimezone(),
    contexto: "personal",
    proyectoId: "",
    asignadoUsuarioId: "",
  };
}

function isValidTimezone(timezone) {
  try {
    return Boolean(timezone.trim()) && Boolean(
      Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() })
        .resolvedOptions().timeZone,
    );
  } catch {
    return false;
  }
}

export default function ActivityForm() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const appliedProjectIdRef = useRef(null);
  const { creationStatus, creationError } = useSelector(
    (state) => state.activities,
  );
  const { user } = useSelector((state) => state.auth);
  const {
    items: projects,
    status: projectsStatus,
    error: projectsError,
    membersByProjectId,
    memberListStatusByProjectId,
    memberListErrorByProjectId,
  } = useSelector((state) => state.projects);

  const [form, setForm] = useState(createInitialForm);
  const [validationError, setValidationError] = useState(null);
  const preselectedProjectId = searchParams.get("projectId")?.trim() ?? "";
  const selectedProject = projects.find(
    (project) => String(project.id) === form.proyectoId,
  );
  const isSelectedProjectCreator = selectedProject?.creador_id === user?.id;
  const selectedProjectMembers = selectedProject
    ? membersByProjectId[selectedProject.id] ?? []
    : [];
  const selectedMembersStatus = selectedProject
    ? memberListStatusByProjectId[selectedProject.id] ?? "idle"
    : "idle";
  const selectedMembersError = selectedProject
    ? memberListErrorByProjectId[selectedProject.id]
    : null;

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    if (!preselectedProjectId || projectsStatus !== "succeeded") return;

    if (appliedProjectIdRef.current === preselectedProjectId) return;

    const project = projects.find(
      (item) => String(item.id) === preselectedProjectId,
    );
    if (!project) return;

    const selectionTimeout = window.setTimeout(() => {
      appliedProjectIdRef.current = preselectedProjectId;
      setForm((currentForm) => ({
        ...currentForm,
        contexto: "proyecto",
        proyectoId: String(project.id),
        asignadoUsuarioId: "",
      }));
    });

    return () => window.clearTimeout(selectionTimeout);
  }, [preselectedProjectId, projects, projectsStatus]);

  useEffect(() => {
    if (
      form.contexto === "proyecto" &&
      isSelectedProjectCreator &&
      selectedMembersStatus === "idle"
    ) {
      dispatch(fetchProjectMembers(selectedProject.id));
    }
  }, [
    dispatch,
    form.contexto,
    isSelectedProjectCreator,
    selectedMembersStatus,
    selectedProject,
  ]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValidationError(null);
    setForm((currentForm) => {
      if (name === "contexto") {
        return {
          ...currentForm,
          contexto: value,
          proyectoId: "",
          asignadoUsuarioId: "",
        };
      }

      if (name === "proyectoId") {
        return { ...currentForm, proyectoId: value, asignadoUsuarioId: "" };
      }

      return { ...currentForm, [name]: value };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const isRecurring = form.recurrente === "1";

    if (isRecurring && !FREQUENCIES.includes(form.frecuencia)) {
      setValidationError({
        field: "frecuencia",
        message: "Elegí una frecuencia válida para la actividad recurrente.",
      });
      return;
    }

    if (isRecurring && !form.fecha) {
      setValidationError({
        field: "fecha",
        message: "Indicá la fecha inicial de la actividad recurrente.",
      });
      return;
    }

    if (isRecurring && !isValidTimezone(form.timezone)) {
      setValidationError({
        field: "timezone",
        message: "Indicá una zona horaria IANA válida, por ejemplo America/Argentina/Buenos_Aires.",
      });
      return;
    }

    if (form.contexto === "proyecto" && !selectedProject) {
      setValidationError({
        field: "proyectoId",
        message: "Elegí un proyecto válido para la actividad.",
      });
      return;
    }

    const assigneeId = Number(form.asignadoUsuarioId);
    if (
      form.asignadoUsuarioId &&
      (!isSelectedProjectCreator ||
        !selectedProjectMembers.some((member) => member.id === assigneeId))
    ) {
      setValidationError({
        field: "asignadoUsuarioId",
        message: "Elegí un miembro válido del proyecto para asignar la actividad.",
      });
      return;
    }

    const activity = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      recurrente: isRecurring ? 1 : 0,
      frecuencia: isRecurring ? form.frecuencia : null,
      fecha: form.fecha || null,
      timezone: isRecurring ? form.timezone.trim() : null,
    };

    if (selectedProject) {
      activity.proyectoId = Number(selectedProject.id);
    }

    if (form.asignadoUsuarioId) {
      activity.asignadoUsuarioId = assigneeId;
    }

    const action = await dispatch(
      createActivity(activity),
    );

    if (createActivity.fulfilled.match(action)) {
      setForm(createInitialForm());
    }
  }

  return (
    <section aria-labelledby="create-activity-title">
      <h2 id="create-activity-title">Nueva actividad</h2>

      {creationError && (
        <p className="activity-form__error" role="alert">
          {creationError}
        </p>
      )}

      <form className="activity-form" onSubmit={handleSubmit}>
        <p className="activity-form__field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            name="titulo"
            value={form.titulo}
            onChange={handleChange}
            required
          />
        </p>

        <p className="activity-form__field">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
          />
        </p>

        <fieldset className="activity-form__type">
          <legend>Tipo de actividad</legend>
          <label>
            <input
              checked={form.recurrente === "0"}
              name="recurrente"
              onChange={handleChange}
              type="radio"
              value="0"
            />
            Una vez
          </label>
          <label>
            <input
              checked={form.recurrente === "1"}
              name="recurrente"
              onChange={handleChange}
              type="radio"
              value="1"
            />
            Recurrente
          </label>
        </fieldset>

        <fieldset className="activity-form__context">
          <legend>Contexto</legend>
          <label>
            <input
              checked={form.contexto === "personal"}
              name="contexto"
              onChange={handleChange}
              type="radio"
              value="personal"
            />
            Personal
          </label>
          <label>
            <input
              checked={form.contexto === "proyecto"}
              name="contexto"
              onChange={handleChange}
              type="radio"
              value="proyecto"
            />
            Proyecto
          </label>
        </fieldset>

        {form.contexto === "proyecto" && (
          <div className="activity-form__project">
            <p className="activity-form__field">
              <label htmlFor="proyectoId">Proyecto</label>
              <select
                aria-describedby={[
                  validationError?.field === "proyectoId" && "proyectoId-error",
                  projectsError && "project-list-error",
                ].filter(Boolean).join(" ") || undefined}
                aria-invalid={validationError?.field === "proyectoId" || undefined}
                disabled={projectsStatus === "loading"}
                id="proyectoId"
                name="proyectoId"
                onChange={handleChange}
                required
                value={form.proyectoId}
              >
                <option value="">
                  {projectsStatus === "loading" ? "Cargando proyectos..." : "Elegí un proyecto"}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.nombre}</option>
                ))}
              </select>
              {validationError?.field === "proyectoId" && (
                <small className="activity-form__error" id="proyectoId-error">
                  {validationError.message}
                </small>
              )}
            </p>

            {projectsError && <p className="activity-form__error" id="project-list-error" role="alert">{projectsError}</p>}

            {isSelectedProjectCreator && (
              <p className="activity-form__field">
                <label htmlFor="asignadoUsuarioId">Asignar a un miembro (opcional)</label>
                <select
                  aria-describedby={[
                    validationError?.field === "asignadoUsuarioId" && "asignadoUsuarioId-error",
                    selectedMembersError && "member-list-error",
                  ].filter(Boolean).join(" ") || undefined}
                  aria-invalid={validationError?.field === "asignadoUsuarioId" || undefined}
                  disabled={selectedMembersStatus === "loading" || selectedMembersStatus === "failed"}
                  id="asignadoUsuarioId"
                  name="asignadoUsuarioId"
                  onChange={handleChange}
                  value={form.asignadoUsuarioId}
                >
                  <option value="">
                    {selectedMembersStatus === "loading"
                      ? "Cargando miembros..."
                      : selectedMembersStatus === "failed"
                        ? "Asignación no disponible"
                        : "Sin asignar"}
                  </option>
                  {selectedProjectMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.nombre}</option>
                  ))}
                </select>
                {selectedMembersError && (
                  <small className="activity-form__error" id="member-list-error" role="alert">
                    No se pudieron cargar los miembros. <button onClick={() => dispatch(fetchProjectMembers(selectedProject.id))} type="button">Reintentar</button>
                  </small>
                )}
              </p>
            )}
          </div>
        )}

        <p className="activity-form__field">
          <label htmlFor="fecha">
            {form.recurrente === "1" ? "Fecha inicial" : "Fecha programada"}
          </label>
          <input
            aria-describedby={validationError?.field === "fecha" ? "fecha-error" : undefined}
            aria-invalid={validationError?.field === "fecha" || undefined}
            id="fecha"
            name="fecha"
            type="date"
            value={form.fecha}
            onChange={handleChange}
            required={form.recurrente === "1"}
          />
          {validationError?.field === "fecha" && (
            <small className="activity-form__error" id="fecha-error">
              {validationError.message}
            </small>
          )}
        </p>

        {form.recurrente === "1" && (
          <div className="activity-form__recurrence">
            <p className="activity-form__field">
              <label htmlFor="frecuencia">Frecuencia</label>
              <select
                aria-describedby={validationError?.field === "frecuencia" ? "frecuencia-error" : undefined}
                aria-invalid={validationError?.field === "frecuencia" || undefined}
                id="frecuencia"
                name="frecuencia"
                value={form.frecuencia}
                onChange={handleChange}
                required
              >
                <option value="">Elegí una frecuencia</option>
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
              </select>
              {validationError?.field === "frecuencia" && (
                <small className="activity-form__error" id="frecuencia-error">
                  {validationError.message}
                </small>
              )}
            </p>

            <p className="activity-form__field">
              <label htmlFor="timezone">Zona horaria</label>
              <input
                aria-describedby={[
                  "timezone-help",
                  validationError?.field === "timezone" && "timezone-error",
                ].filter(Boolean).join(" ")}
                aria-invalid={validationError?.field === "timezone" || undefined}
                id="timezone"
                name="timezone"
                onChange={handleChange}
                required
                value={form.timezone}
              />
              <small id="timezone-help">
                Usá un identificador IANA, por ejemplo America/Argentina/Buenos_Aires.
              </small>
              {validationError?.field === "timezone" && (
                <small className="activity-form__error" id="timezone-error">
                  {validationError.message}
                </small>
              )}
            </p>
          </div>
        )}

        <button type="submit" disabled={creationStatus === "loading"}>
          {creationStatus === "loading"
            ? "Guardando..."
            : "Crear actividad"}
        </button>
      </form>
    </section>
  );
}
