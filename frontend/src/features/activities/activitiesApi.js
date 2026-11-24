import httpClient from "../../api/httpClient";

export async function getActivitiesRequest() {
    const { data } = await httpClient.get("/actividades");
    return data.actividades;
}

export async function createActivityRequest(activity){
    const { data } = await httpClient.post("/actividades", activity);
    return data.actividad;
}

export async function updateActivityRequest(activityId, activity) {
  const { data } = await httpClient.put(`/actividades/${activityId}`, activity);
  return data.actividad;
}

export async function deleteActivityRequest(activityId) {
  await httpClient.delete(`/actividades/${activityId}`);
}

export async function updateActivityAssignmentRequest(activityId, asignadoUsuarioId) {
  const { data } = await httpClient.patch(
    `/actividades/${activityId}/asignacion`,
    { asignadoUsuarioId },
  );
  return data.actividad;
}

export async function completeActivityRequest(activityId) {
  const { data } = await httpClient.post(
    `/actividades/${activityId}/cumplimientos`,
  );

  const cumplimiento = data.cumplimiento;
  if (!Number.isFinite(cumplimiento?.puntosTotales)) {
    throw new Error("La respuesta de cumplimiento no incluye el total de XP");
  }

  return {
    ...cumplimiento,
    // Older idempotent responses identify the retry through their message.
    idempotent: cumplimiento.idempotent ?? data.mensaje === "Actividad ya completada",
  };
}
