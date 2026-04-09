import axios from "axios";

// Create an Axios instance configured to talk to our backend
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3003/api",
  withCredentials: true,
  headers: {
    "X-Kiosk-Key": import.meta.env.VITE_KIOSK_SECRET_KEY, // Her isteğe gizli anahtarı ekle
  }
});

export default apiClient;
