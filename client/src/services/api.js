import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry transient 500 / network drop errors once after a brief pause
    if (
      config &&
      !config._hasRetried &&
      (!error.response || error.response.status >= 500)
    ) {
      config._hasRetried = true;
      await new Promise((r) => setTimeout(r, 800));
      return api(config);
    }

    const isPublicPage = ["/login", "/register"].includes(
      window.location.pathname
    );

    if (error.response?.status === 401 && !isPublicPage) {
      const token = localStorage.getItem("token");

      if (token) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
