import httpClient from "../../api/httpClient";

export async function loginRequest(credentials) {
  const { data } = await httpClient.post("/auth/login", credentials);
  return data;
}

export async function registerRequest(userData) {
  const { data } = await httpClient.post("/auth/register", userData);
  return data;
}

export async function getCurrentUserRequest() {
  const { data } = await httpClient.get("/auth/me");
  return data.user;
}
