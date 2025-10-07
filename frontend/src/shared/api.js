import axios from "axios";

export const getBackendUrl = () => {
  const envValue = process.env.REACT_APP_BACKEND_URL?.trim();
  if (envValue) {
    return envValue.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const derivedPort = port === "3000" ? "8000" : port;
    const portSegment = derivedPort ? `:${derivedPort}` : "";
    return `${protocol}//${hostname}${portSegment}`;
  }

  return "http://localhost:8000";
};

export const BACKEND_URL = getBackendUrl();
const API_ROOT = `${BACKEND_URL}/api`;

export const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
  let storedToken = null;
  if (typeof window !== "undefined") {
    storedToken = localStorage.getItem("authToken");
    if (storedToken && ["null", "undefined", ""].includes(storedToken)) {
      storedToken = null;
    }
  }

  const token = storedToken || process.env.REACT_APP_DEV_AUTH_TOKEN || null;

  if (!storedToken && typeof window !== "undefined" && token) {
    localStorage.setItem("authToken", token);
  }
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export const api = {
  getNekretnine: () => apiClient.get(`${API_ROOT}/nekretnine`),
  createNekretnina: (data) => apiClient.post(`${API_ROOT}/nekretnine`, data),
  updateNekretnina: (id, data) =>
    apiClient.put(`${API_ROOT}/nekretnine/${id}`, data),
  deleteNekretnina: (id) => apiClient.delete(`${API_ROOT}/nekretnine/${id}`),

  getZakupnici: (params = {}) =>
    apiClient.get(`${API_ROOT}/zakupnici`, { params }),
  createZakupnik: (data) => apiClient.post(`${API_ROOT}/zakupnici`, data),
  updateZakupnik: (id, data) =>
    apiClient.put(`${API_ROOT}/zakupnici/${id}`, data),

  getUgovori: () => apiClient.get(`${API_ROOT}/ugovori`),
  createUgovor: (data) => apiClient.post(`${API_ROOT}/ugovori`, data),
  updateUgovor: (id, data) => apiClient.put(`${API_ROOT}/ugovori/${id}`, data),
  updateStatusUgovora: (id, status) =>
    apiClient.put(`${API_ROOT}/ugovori/${id}/status`, { novi_status: status }),

  getDokumenti: () => apiClient.get(`${API_ROOT}/dokumenti`),
  getDokumentiNekretnine: (id) =>
    apiClient.get(`${API_ROOT}/dokumenti/nekretnina/${id}`),
  getDokumentiZakupnika: (id) =>
    apiClient.get(`${API_ROOT}/dokumenti/zakupnik/${id}`),
  getDokumentiUgovora: (id) =>
    apiClient.get(`${API_ROOT}/dokumenti/ugovor/${id}`),
  getDokumentiPropertyUnit: (id) =>
    apiClient.get(`${API_ROOT}/dokumenti/property-unit/${id}`),
  createDokument: (data) => {
    const formData = new FormData();
    formData.append("naziv", data.naziv);
    formData.append("tip", data.tip);
    if (data.opis) {
      formData.append("opis", data.opis);
    }

    if (data.nekretnina_id) {
      formData.append("nekretnina_id", data.nekretnina_id);
    }
    if (data.zakupnik_id) {
      formData.append("zakupnik_id", data.zakupnik_id);
    }
    if (data.ugovor_id) {
      formData.append("ugovor_id", data.ugovor_id);
    }
    if (data.property_unit_id) {
      formData.append("property_unit_id", data.property_unit_id);
    }
    if (data.file) {
      formData.append("file", data.file);
    }

    return apiClient.post(`${API_ROOT}/dokumenti`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  getUnits: (params = {}) => apiClient.get(`${API_ROOT}/units`, { params }),
  getUnitsForProperty: (propertyId) =>
    apiClient.get(`${API_ROOT}/nekretnine/${propertyId}/units`),
  getUnit: (unitId) => apiClient.get(`${API_ROOT}/units/${unitId}`),
  createUnit: (propertyId, payload) =>
    apiClient.post(`${API_ROOT}/nekretnine/${propertyId}/units`, payload),
  updateUnit: (unitId, payload) =>
    apiClient.put(`${API_ROOT}/units/${unitId}`, payload),
  deleteUnit: (unitId) => apiClient.delete(`${API_ROOT}/units/${unitId}`),
  bulkUpdateUnits: (payload) =>
    apiClient.post(`${API_ROOT}/units/bulk-update`, payload),

  getDashboard: () => apiClient.get(`${API_ROOT}/dashboard`),

  getPodsjetnici: () => apiClient.get(`${API_ROOT}/podsjetnici`),
  getAktivniPodsjetnici: () => apiClient.get(`${API_ROOT}/podsjetnici/aktivni`),

  parsePdfContract: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(`${API_ROOT}/ai/parse-pdf-contract`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  getMaintenanceTasks: (params = {}) =>
    apiClient.get(`${API_ROOT}/maintenance-tasks`, { params }),
  getMaintenanceTask: (id) =>
    apiClient.get(`${API_ROOT}/maintenance-tasks/${id}`),
  createMaintenanceTask: (payload) =>
    apiClient.post(`${API_ROOT}/maintenance-tasks`, payload),
  updateMaintenanceTask: (id, payload) =>
    apiClient.patch(`${API_ROOT}/maintenance-tasks/${id}`, payload),
  deleteMaintenanceTask: (id) =>
    apiClient.delete(`${API_ROOT}/maintenance-tasks/${id}`),
  addMaintenanceComment: (id, payload) =>
    apiClient.post(`${API_ROOT}/maintenance-tasks/${id}/comments`, payload),

  getAuditLogs: (params = {}) =>
    apiClient.get(`${API_ROOT}/audit/logs`, { params }),

  markReminderAsSent: (id) =>
    apiClient.put(`${API_ROOT}/podsjetnici/${id}/oznaci-poslan`),
};

export const buildDocumentUrl = (dokument) => {
  if (!dokument || !dokument.putanja_datoteke) {
    return null;
  }
  return `${BACKEND_URL}/${dokument.putanja_datoteke}`;
};

export { API_ROOT as API };
