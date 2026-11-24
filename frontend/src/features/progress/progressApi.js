import httpClient from "../../api/httpClient";

export async function getPersonalProgressRequest() {
  const { data } = await httpClient.get("/progreso/personal");
  return data;
}

export async function getProjectProgressRequest(projectId) {
  const { data } = await httpClient.get(`/progreso/proyectos/${projectId}`);
  return data;
}
