import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchProjects } from "../../features/projects/projectsSlice";
import {
  fetchPersonalProgress,
  fetchProjectProgress,
} from "../../features/progress/progressSlice";
import "./ProgressPage.css";

function formatPercentage(rate) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(rate ?? 0);
}

function getRate(activity) {
  return Number(activity.rate ?? activity.completionRate ?? 0);
}

function formatActivityTitle(title) {
  return title.length > 24 ? `${title.slice(0, 21)}...` : title;
}

function formatDate(date) {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatRecurrence(recurrence) {
  if (!recurrence) return "Una vez";
  return `${recurrence.frequency} (${recurrence.timezone})`;
}

function ActivityRateChart({ activities, title, description }) {
  const data = activities.map((activity) => ({
    title: activity.title,
    rate: getRate(activity),
  }));

  return (
    <figure className="progress-chart">
      <figcaption>
        <h2>{title}</h2>
        <p>{description}</p>
      </figcaption>
      <div
        className="progress-chart__activity"
        role="img"
        aria-label={`${title}. ${description}`}
        style={{ "--activity-count": data.length }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 40, bottom: 8, left: 16 }}
          >
            <CartesianGrid stroke="#ded9e8" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 1]} tickFormatter={formatPercentage} />
            <YAxis
              dataKey="title"
              type="category"
              width={128}
              tickFormatter={formatActivityTitle}
            />
            <Tooltip
              formatter={(value) => [formatPercentage(value), "Tasa de cumplimiento"]}
              labelFormatter={(value) => `Actividad: ${value}`}
            />
            <Bar dataKey="rate" fill="#6857b8" name="Tasa de cumplimiento">
              <LabelList dataKey="rate" position="right" formatter={formatPercentage} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ProjectCompletionChart({ completed, eligible }) {
  const completedCount = Number(completed) || 0;
  const eligibleCount = Number(eligible) || 0;
  const remaining = Math.max(eligibleCount - completedCount, 0);
  const data = [{ label: "Ocurrencias elegibles", completed: completedCount, remaining }];

  return (
    <figure className="progress-chart">
      <figcaption>
        <h2>Ocurrencias completadas y pendientes</h2>
        <p>Resumen agregado de las ocurrencias elegibles del proyecto.</p>
      </figcaption>
      <dl className="progress-chart__summary-data" aria-label="Resumen de ocurrencias del proyecto">
        <div>
          <dt>Ocurrencias elegibles</dt>
          <dd>{eligibleCount}</dd>
        </div>
        <div>
          <dt>Ocurrencias completadas</dt>
          <dd>{completedCount}</dd>
        </div>
        <div>
          <dt>Ocurrencias pendientes</dt>
          <dd>{remaining}</dd>
        </div>
      </dl>
      <div
        className="progress-chart__summary"
        role="img"
        aria-label={`Resumen agregado: ${eligibleCount} ocurrencias elegibles, ${completedCount} completadas y ${remaining} pendientes.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
            <CartesianGrid stroke="#ded9e8" strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" name="Ocurrencias completadas" fill="#18806d" />
            <Bar dataKey="remaining" name="Ocurrencias pendientes" fill="#d59038" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function ProgressPage() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const appliedProjectIdRef = useRef(null);
  const [reportContext, setReportContext] = useState("personal");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const preselectedProjectId = searchParams.get("projectId")?.trim() ?? "";
  const {
    personal,
    status,
    error,
    projectReport,
    projectStatus,
    projectError,
  } = useSelector((state) => state.progress);
  const {
    items: projects,
    status: projectsStatus,
    error: projectsError,
  } = useSelector((state) => state.projects);

  useEffect(() => {
    dispatch(fetchPersonalProgress());
  }, [dispatch]);

  useEffect(() => {
    if ((reportContext === "project" || preselectedProjectId) && projectsStatus === "idle") {
      dispatch(fetchProjects());
    }
  }, [dispatch, preselectedProjectId, projectsStatus, reportContext]);

  useEffect(() => {
    if (!preselectedProjectId || projectsStatus !== "succeeded") return;

    if (appliedProjectIdRef.current === preselectedProjectId) return;

    const project = projects.find(
      (item) => String(item.id) === preselectedProjectId,
    );
    if (!project) return;

    const selectionTimeout = window.setTimeout(() => {
      appliedProjectIdRef.current = preselectedProjectId;
      setReportContext("project");
      setSelectedProjectId(String(project.id));
    });

    return () => window.clearTimeout(selectionTimeout);
  }, [preselectedProjectId, projects, projectsStatus]);

  useEffect(() => {
    if (reportContext === "project" && selectedProjectId) {
      dispatch(fetchProjectProgress(selectedProjectId));
    }
  }, [dispatch, reportContext, selectedProjectId]);

  const activities = personal?.activities ?? [];
  const history = personal?.byDate ?? [];
  const projectActivities = projectReport?.activities ?? [];
  const isPersonalReport = reportContext === "personal";

  function selectReportContext(event) {
    setReportContext(event.target.value);
  }

  function selectProject(event) {
    setSelectedProjectId(event.target.value);
  }

  return (
    <section
      className="progress-page"
      aria-busy={isPersonalReport ? status === "loading" : projectStatus === "loading"}
      aria-labelledby="progress-title"
    >
      <header className="progress-page__header">
        <p className="progress-page__eyebrow">TaskQuest</p>
        <h1 id="progress-title">Progreso</h1>
        <p>Consultá tu avance personal o el cumplimiento agregado de un proyecto.</p>
      </header>

      <fieldset className="progress-context" aria-describedby="progress-context-help">
        <legend>Elegí el informe que querés consultar</legend>
        <p id="progress-context-help">Los informes de proyecto muestran datos del equipo, sin detalle por integrante.</p>
        <div className="progress-context__options">
          <label>
            <input
              type="radio"
              name="report-context"
              value="personal"
              checked={isPersonalReport}
              onChange={selectReportContext}
            />
            Mi progreso personal
          </label>
          <label>
            <input
              type="radio"
              name="report-context"
              value="project"
              checked={!isPersonalReport}
              onChange={selectReportContext}
            />
            Informe de proyecto
          </label>
        </div>
      </fieldset>

      {!isPersonalReport && (
        <section className="progress-project-picker" aria-labelledby="project-picker-title">
          <h2 id="project-picker-title">Proyecto</h2>
          {projectsStatus === "loading" && (
            <p role="status" aria-live="polite">Cargando tus proyectos...</p>
          )}
          {projectsStatus === "failed" && (
            <div className="progress-page__state progress-page__state--error" role="alert">
              <p>{projectsError}</p>
              <button type="button" onClick={() => dispatch(fetchProjects())}>Reintentar</button>
            </div>
          )}
          {projectsStatus === "succeeded" && projects.length === 0 && (
            <p className="progress-page__state">Todavía no pertenecés a ningún proyecto.</p>
          )}
          {projects.length > 0 && (
            <label className="progress-project-picker__select" htmlFor="project-report">
              Elegí un proyecto
              <select id="project-report" value={selectedProjectId} onChange={selectProject}>
                <option value="">Seleccioná un proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.nombre}</option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {isPersonalReport && status === "loading" && (
        <p className="progress-page__state" role="status" aria-live="polite">
          Cargando tu progreso...
        </p>
      )}

      {isPersonalReport && status === "failed" && (
        <div className="progress-page__state progress-page__state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => dispatch(fetchPersonalProgress())}>
            Reintentar
          </button>
        </div>
      )}

      {isPersonalReport && status === "succeeded" && (
        <>
          <dl className="progress-metrics" aria-label="Resumen de progreso">
            <div className="progress-metrics__card">
              <dt>Ocurrencias completadas</dt>
              <dd>{personal.completed}</dd>
              <small>de {personal.eligible} ocurrencias elegibles</small>
            </div>
            <div className="progress-metrics__card">
              <dt>Tasa de cumplimiento</dt>
              <dd>{formatPercentage(personal.rate ?? personal.completionRate)}</dd>
              <small>sobre ocurrencias elegibles</small>
            </div>
            <div className="progress-metrics__card">
              <dt>XP total histórico</dt>
              <dd>{personal.xp}</dd>
              <small>suma de todos los XP registrados</small>
            </div>
          </dl>

          {history.length > 0 && (
            <figure className="progress-history">
              <figcaption>
                <h2>Historial diario</h2>
                <p>Ocurrencias completadas y XP ganados en cada fecha. El total de arriba suma todo el historial.</p>
              </figcaption>
              <div className="progress-history__chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history}
                    title="Historial diario de ocurrencias completadas y XP"
                    margin={{ top: 8, right: 8, bottom: 8, left: -20 }}
                  >
                    <CartesianGrid stroke="#ded9e8" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis yAxisId="activities" allowDecimals={false} />
                    <YAxis yAxisId="xp" orientation="right" allowDecimals={false} />
                    <Tooltip labelFormatter={formatDate} />
                    <Legend />
                    <Line
                      yAxisId="activities"
                      type="monotone"
                      dataKey="completed"
                      name="Ocurrencias completadas"
                      stroke="#6857b8"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="xp"
                      type="monotone"
                      dataKey="xp"
                      name="XP"
                      stroke="#18806d"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          )}

           {activities.length === 0 ? (
             <p className="progress-page__state">Todavía no hay actividades para mostrar.</p>
           ) : (
            <>
              <ActivityRateChart
                activities={activities}
                title="Cumplimiento por actividad"
                description="Compará la tasa de cumplimiento de las ocurrencias elegibles de cada una de tus actividades."
              />
              <section className="progress-activities" aria-labelledby="progress-activities-title">
                <h2 id="progress-activities-title">Actividades</h2>
                <div className="progress-activities__table-wrapper">
                  <table>
                    <caption>Progreso por actividad</caption>
                    <thead>
                      <tr>
                        <th scope="col">Actividad</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Ocurrencias completadas</th>
                        <th scope="col">Tasa</th>
                        <th scope="col">Recurrencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((activity) => (
                        <tr key={activity.activityId}>
                          <th scope="row">{activity.title}</th>
                          <td>{activity.projectId === null ? "Personal" : "De proyecto"}</td>
                          <td>{activity.completed} de {activity.eligible}</td>
                          <td>{formatPercentage(getRate(activity))}</td>
                          <td>{formatRecurrence(activity.recurrence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {!isPersonalReport && selectedProjectId && projectStatus === "loading" && (
        <p className="progress-page__state" role="status" aria-live="polite">
          Cargando el informe del proyecto...
        </p>
      )}

      {!isPersonalReport && selectedProjectId && projectStatus === "failed" && (
        <div className="progress-page__state progress-page__state--error" role="alert">
          <p>{projectError}</p>
          <button type="button" onClick={() => dispatch(fetchProjectProgress(selectedProjectId))}>
            Reintentar
          </button>
        </div>
      )}

      {!isPersonalReport && selectedProjectId && projectStatus === "succeeded" && (
        <>
          <section className="progress-project-summary" aria-labelledby="project-report-title">
            <h2 id="project-report-title">{projectReport.project.nombre}</h2>
            <p>
              Resumen de cumplimiento de las ocurrencias elegibles del proyecto al {formatDate(projectReport.asOf)}.
            </p>
          </section>

           <dl className="progress-metrics" aria-label="Resumen del proyecto">
            <div className="progress-metrics__card">
              <dt>Ocurrencias completadas</dt>
              <dd>{projectReport.completed}</dd>
              <small>de {projectReport.eligible} ocurrencias elegibles</small>
            </div>
            <div className="progress-metrics__card">
              <dt>Tasa de cumplimiento</dt>
              <dd>{formatPercentage(projectReport.rate ?? projectReport.completionRate)}</dd>
              <small>sobre ocurrencias elegibles</small>
            </div>
           </dl>

           <ProjectCompletionChart
             completed={projectReport.completed}
             eligible={projectReport.eligible}
           />

           {projectActivities.length === 0 ? (
              <p className="progress-page__state">No hay ocurrencias elegibles para mostrar en este proyecto.</p>
           ) : (
            <>
              <ActivityRateChart
                activities={projectActivities}
                title="Cumplimiento agregado por actividad"
                description="Compará la tasa de cumplimiento agregada de las ocurrencias elegibles de cada actividad del proyecto."
              />
              <section className="progress-activities" aria-labelledby="project-activities-title">
                <h2 id="project-activities-title">Actividades del proyecto</h2>
                <div className="progress-activities__table-wrapper">
                  <table>
                    <caption>Cumplimiento agregado por actividad del proyecto</caption>
                    <thead>
                      <tr>
                        <th scope="col">Actividad</th>
                        <th scope="col">Ocurrencias completadas</th>
                        <th scope="col">Tasa</th>
                        <th scope="col">Recurrencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectActivities.map((activity) => (
                        <tr key={activity.activityId}>
                          <th scope="row">{activity.title}</th>
                          <td>{activity.completed} de {activity.eligible}</td>
                          <td>{formatPercentage(getRate(activity))}</td>
                          <td>{formatRecurrence(activity.recurrence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
