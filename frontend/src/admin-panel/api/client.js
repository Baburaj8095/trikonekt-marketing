import API from "../../api/api";

// Re-export the existing axios instance used across the app so we share
// JWT/session handling, interceptors, baseURL and loading overlay behavior.
export default API;
