import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  completeActivity,
  completionKeyForActivity,
  deleteActivity,
  fetchActivities,
} from "../../features/activities/activitiesSlice";
import ActivityForm from "../../features/activities/ActivityForm";
import ActivityEditor from "../../features/activities/ActivityEditor";
import { fetchProjects } from "../../features/projects/projectsSlice";
import "./ActivitiesPage.css";

function nextPeriodBoundary(activity, now) {
  const currentKey = completionKeyForActivity(activity, now);
  let before = now.getTime();
  let after = before + (
    activity.frecuencia === "semanal" ? 8 : 2
  ) * 24 * 60 * 60 * 1000;

  // Search the timezone-aware completion key rather than assuming local midnight.
  while (completionKeyForActivity(activity, new Date(after)) === currentKey) {
    after += 24 * 60 * 60 * 1000;
  }

  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (completionKeyForActivity(activity, new Date(middle)) === currentKey) {
      before = middle;
    } else {
      after = middle;
    }
  }

  return after;
}

function nextUtcDayBoundary(now) {
  const boundary = new Date(now);
  boundary.setUTCHours(24, 0, 0, 0);
  return boundary.getTime();
}

export default function ActivitiesPage() {
  const dispatch = useDispatch();
  const [periodNow, setPeriodNow] = useState(() => new Date());
  const {
    items,
    status,
    error,
    completionStatusById,
    completionErrorById,
    completionById,
    deletionStatusById,
    deletionErrorById,
  } = useSelector((state) => state.activities);
  const { items: projects } = useSelector((state) => state.projects);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchActivities());
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    const recurringActivities = items.filter(
      (activity) => Number(activity.recurrente) === 1,
    );
    const now = new Date();
    const nextBoundary = Math.min(
      nextUtcDayBoundary(now),
      ...recurringActivities.map((activity) => nextPeriodBoundary(activity, now)),
    );
    const refreshPeriod = () => setPeriodNow(new Date());
    const timeoutId = window.setTimeout(
      refreshPeriod,
      Math.max(0, nextBoundary - now.getTime()) + 100,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshPeriod();
    };

    window.addEventListener("focus", refreshPeriod);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refreshPeriod);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [items, periodNow]);

  function handleComplete(activity, completionKey) {
    dispatch(completeActivity({ activityId: activity.id, completionKey }));
  }

  function handleDelete(activity) {
    if (window.confirm(`Se eliminará la actividad "${activity.titulo}". Esta acción no se puede deshacer.`)) {
      dispatch(deleteActivity(activity.id));
    }
  }

  return (
    <section
      className="activities-page"
      aria-busy={status === "loading"}
      aria-labelledby="activities-title"
    >
      <header className="activities-page__header">
        <p className="activities-page__eyebrow">TaskQuest</p>
        <h1 id="activities-title">Actividades</h1>
        <p className="activities-page__intro">
          Organizá y seguí tus próximos desafíos.
        </p>
      </header>

      <ActivityForm />

      {status === "loading" && (
        <p className="activities-page__state" role="status" aria-live="polite">
          Cargando actividades...
        </p>
      )}

      {status === "failed" && (
        <p
          className="activities-page__state activities-page__state--error"
          role="alert"
        >
          {error}
        </p>
      )}

      {status === "succeeded" && items.length === 0 && (
        <p className="activities-page__state">Todavía no tenés actividades.</p>
      )}

      {status === "succeeded" && items.length > 0 && (
        <ul className="activities-page__grid">
          {items.map((activity) => {
            const completionKey = completionKeyForActivity(activity, periodNow);
            const completionStatus = completionStatusById[completionKey];
            const completionError = completionErrorById[completionKey];
            const completion = completionById[completionKey];
            const isRecurring = Number(activity.recurrente) === 1;
            const hasNotStarted = (
              !isRecurring
              && activity.fecha
              && activity.fecha > periodNow.toISOString().slice(0, 10)
            );
            const canComplete = (
              activity.estado === "pendiente" &&
              completionStatus !== "succeeded" &&
              !hasNotStarted
            );
            const project = projects.find((item) => item.id === activity.proyecto_id);
            const canEdit = activity.usuario_id === user?.id;
            const canAssign = Boolean(
              activity.proyecto_id && project?.creador_id === user?.id,
            );
            const actionCount = Number(canComplete) + (canEdit ? 2 : 0);

            return (
              <li className="activity-card" key={activity.id}>
                <article className="activity-card__content">
                <div className="activity-card__heading">
                  <h2>{activity.titulo}</h2>
                  <span className="activity-card__status">
                    {isRecurring ? "Recurrente" : activity.estado}
                  </span>
                </div>

                {activity.descripcion && (
                  <p className="activity-card__description">
                    {activity.descripcion}
                  </p>
                )}

                <dl className="activity-card__metadata">
                  {isRecurring && (
                    <div className="activity-card__metadata-item">
                      <dt>Ocurrencia</dt>
                      <dd>{completionStatus === "succeeded" ? "Cumplida" : "Pendiente"}</dd>
                    </div>
                  )}

                  {!isRecurring && (
                    <div className="activity-card__metadata-item">
                      <dt>Estado</dt>
                      <dd>{activity.estado}</dd>
                    </div>
                  )}

                  {activity.fecha && (
                    <div className="activity-card__metadata-item">
                      <dt>{isRecurring ? "Inicio" : "Fecha"}</dt>
                      <dd>
                        <time dateTime={activity.fecha}>{activity.fecha}</time>
                      </dd>
                    </div>
                  )}

                  {isRecurring && (
                    <div className="activity-card__metadata-item">
                      <dt>Frecuencia</dt>
                      <dd>{activity.frecuencia}</dd>
                    </div>
                  )}

                  {activity.proyecto_id && (
                    <div className="activity-card__metadata-item">
                      <dt>Proyecto</dt>
                      <dd>{project?.nombre ?? "Proyecto compartido"}</dd>
                    </div>
                  )}
                </dl>

                {(canComplete || canEdit || canAssign) && (
                  <div className={`activity-card__actions activity-card__actions--${actionCount}`}>
                    {canComplete && (
                      <button
                        className="activity-card__complete"
                        disabled={completionStatus === "loading"}
                        onClick={() => handleComplete(activity, completionKey)}
                        type="button"
                      >
                        {completionStatus === "loading"
                          ? "Completando..."
                          : isRecurring
                            ? "Completar ocurrencia"
                            : "Completar actividad"}
                      </button>
                    )}

                    {(canEdit || canAssign) && (
                      <ActivityEditor
                        activity={activity}
                        canAssign={canAssign}
                        canEdit={canEdit}
                        deleteAction={canEdit && (
                          <button
                            className="activity-card__delete"
                            disabled={deletionStatusById[activity.id] === "loading"}
                            onClick={() => handleDelete(activity)}
                            type="button"
                          >
                            {deletionStatusById[activity.id] === "loading" ? "Eliminando..." : "Eliminar actividad"}
                          </button>
                        )}
                      />
                    )}
                  </div>
                )}

                {canComplete && isRecurring && (
                  <p className="activity-card__action-note">
                    La próxima se habilita al iniciar el siguiente período.
                  </p>
                )}

                {hasNotStarted && (
                  <p className="activity-card__action-note" role="status">
                    Disponible para completar el {activity.fecha}.
                  </p>
                )}

                {completionStatus === "succeeded" && completion && (
                  <p className="activity-card__completion" role="status" aria-live="polite">
                    {completion.idempotent
                      ? isRecurring
                        ? "La ocurrencia actual ya estaba cumplida."
                        : "Esta actividad ya estaba cumplida."
                      : isRecurring
                        ? `Ocurrencia cumplida. +${completion.puntosGanados} XP.`
                        : `Actividad cumplida. Ganaste ${completion.puntosGanados} XP.`}
                  </p>
                )}

                {completionStatus === "failed" && completionError && (
                  <p className="activity-card__completion activity-card__completion--error" role="alert" aria-live="assertive">
                    {completionError}
                  </p>
                )}

                {deletionErrorById[activity.id] && <p className="activity-card__completion activity-card__completion--error" role="alert">{deletionErrorById[activity.id]}</p>}
              </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
