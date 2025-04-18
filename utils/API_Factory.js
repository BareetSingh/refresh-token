import axios from "axios";

const API_BASE_URL = "";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      window.location.href = "/login";
      return;
    }

    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-tokens`, {
      refreshToken,
    });
    const newAccessToken = response?.data?.access?.token;
    localStorage.setItem("authToken", newAccessToken);
    localStorage.setItem("refreshToken", response?.data?.refresh?.token);
    processQueue(null, newAccessToken);
    return newAccessToken;
  } catch (error) {
    console.error("Refresh Token Error:", error);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userProfile");
    processQueue(error, null);
    window.location.href = "/login";
    throw error;
  }
};

const API_Factory = async (method, endpoint, data = null, token = null, retry = false, contentType) => {
  try {
    const headers = { "Content-Type": contentType };
    const authToken = token || localStorage.getItem("authToken");
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await axios({ method, url: `${API_BASE_URL}${endpoint}`, data, headers });
    return response;
  } catch (error) {
    if (!error.response) {
      // Handle network errors separately
      console.error("Network Error:", error.message);
      return {
        error: true,
        status: 503, // Service Unavailable
        message: "Unable to reach the server. Please check your internet connection or try again later.",
      };
    }

    if (error.response.status === 401 && retry) {
      if (isRefreshing) {
        // If the token is already being refreshed, add the request to the queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            return API_Factory(method, endpoint, data, token, false);
          })
          .catch(err => {
            throw err;
          });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        return API_Factory(method, endpoint, data, newToken, false);
      } catch (refreshError) {
        isRefreshing = false;
        console.error("Token refresh failed:", refreshError);
        throw refreshError;
      }
    }

    console.error("API Error:", error.response.status, error.response.data || error.message);

    return {
      error: true,
      status: error.response.status || 500,
      message: error.response.data?.message || "API Request Failed",
    };
  }
};

// ✅ Export API_Factory
export default API_Factory;