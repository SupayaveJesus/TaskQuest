import httpClient from "../../api/httpClient";

export async function getProjectsRequest() {
  const { data } = await httpClient.get("/proyectos");
  return data.proyectos;
}

export async function createProjectRequest(project) {
  const { data } = await httpClient.post("/proyectos", project);
  return data.proyecto;
}

export async function updateProjectRequest(projectId, project) {
  const { data } = await httpClient.put(`/proyectos/${projectId}`, project);
  return data.proyecto;
}

export async function deleteProjectRequest(projectId) {
  await httpClient.delete(`/proyectos/${projectId}`);
}

export async function getProjectMembersRequest(projectId) {
  const { data } = await httpClient.get(`/proyectos/${projectId}/miembros`);
  return data.miembros;
}

export async function addProjectMemberByEmailRequest(projectId, correo) {
  const { data } = await httpClient.post(`/proyectos/${projectId}/miembros/por-correo`, { correo });
  return data.miembro;
}

export async function removeProjectMemberRequest(projectId, userId) {
  await httpClient.delete(`/proyectos/${projectId}/miembros/${userId}`);
}
