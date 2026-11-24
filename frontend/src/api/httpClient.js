import axios from "axios";

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("taskquest_token");

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

export default httpClient;
