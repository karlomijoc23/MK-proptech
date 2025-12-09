import axios from "axios";

export const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
};

export const BACKEND_URL = getBackendUrl();
const API_ROOT = `${BACKEND_URL}/api`;

export const apiClient = axios.create({
  timeout: 120000, // 2 minutes timeout for AI operations
});

const TENANT_STORAGE_KEY = "proptech:currentTenantId";
const DEFAULT_TENANT_ID =
  process.env.REACT_APP_DEFAULT_TENANT_ID?.trim() || "tenant-default";

let activeTenantId = DEFAULT_TENANT_ID;
const tenantListeners = new Set();

const readTenantFromStorage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_TENANT_ID;
  }
  const stored = localStorage.getItem(TENANT_STORAGE_KEY);
  if (!stored || stored === "undefined" || stored === "null") {
    return DEFAULT_TENANT_ID;
  }
  return stored;
};

export const getActiveTenantId = () => {
  if (!activeTenantId) {
    activeTenantId = readTenantFromStorage();
  }
  return activeTenantId || DEFAULT_TENANT_ID;
};

export const setActiveTenantId = (tenantId, { persist = true } = {}) => {
  const nextTenant = tenantId?.trim() || DEFAULT_TENANT_ID;
  activeTenantId = nextTenant;
  if (typeof window !== "undefined" && persist) {
    localStorage.setItem(TENANT_STORAGE_KEY, nextTenant);
  }
  tenantListeners.forEach((listener) => {
    try {
      listener(nextTenant);
    } catch (error) {
      console.error("Tenant listener failed", error);
    }
  });
  return nextTenant;
};

export const subscribeToTenantChanges = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }
  tenantListeners.add(listener);
  return () => tenantListeners.delete(listener);
};

// Initialise tenant id from storage eagerly in browser environments
if (typeof window !== "undefined") {
  activeTenantId = readTenantFromStorage();
}

apiClient.interceptors.request.use((config) => {
  let token = null;
  if (typeof window !== "undefined") {
    token = window.localStorage.getItem("authToken");
    if (token && ["null", "undefined", ""].includes(token)) {
      token = null;
    }
  }

  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  const tenantId = getActiveTenantId();
  if (tenantId) {
    config.headers = config.headers || {};
    config.headers["X-Tenant-Id"] = tenantId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only trigger logout for 401s on critical endpoints or if repeated
    // For now, let's just ensure we don't loop.
    // Also, if the error is from a "check" endpoint, maybe don't logout immediately?
    // But 401 usually means token is invalid.

    // Check if the request was for a public endpoint or if we are already logging out
    if (error?.response?.status === 401) {
      // Avoid dispatching if we are already on login page
      if (window.location.pathname !== "/login") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

export const api = {
  login: (payload) => apiClient.post(`${API_ROOT}/auth/login`, payload),
  getCurrentUser: () => apiClient.get(`${API_ROOT}/auth/me`),
  registerUser: (payload) =>
    apiClient.post(`${API_ROOT}/auth/register`, payload),
  getUsers: () => apiClient.get(`${API_ROOT}/users`),
  getTenants: () => apiClient.get(`${API_ROOT}/tenants`),
  createTenant: (data) => apiClient.post(`${API_ROOT}/tenants`, data),
  getCurrentTenant: () => apiClient.get(`${API_ROOT}/tenants/current`),
  getTenant: (id) => apiClient.get(`${API_ROOT}/tenants/${id}`),
  updateTenant: (id, data) => apiClient.put(`${API_ROOT}/tenants/${id}`, data),

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

  getUgovori: (params = {}) => apiClient.get(`${API_ROOT}/ugovori`, { params }),
  createUgovor: (data) => apiClient.post(`${API_ROOT}/ugovori`, data),
  updateUgovor: (id, data) => apiClient.put(`${API_ROOT}/ugovori/${id}`, data),
  updateStatusUgovora: (id, status) =>
    apiClient.put(`${API_ROOT}/ugovori/${id}/status`, { novi_status: status }),
  deleteUgovor: (id) => apiClient.delete(`${API_ROOT}/ugovori/${id}`),

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
    if (data.metadata) {
      try {
        formData.append("metadata", JSON.stringify(data.metadata));
      } catch (error) {
        console.error("Neuspješno serijaliziranje metadata polja", error);
      }
    }
    if (data.file) {
      formData.append("file", data.file);
    }

    return apiClient.post(`${API_ROOT}/dokumenti`, formData);
  },
  updateDokument: (id, data) =>
    apiClient.put(`${API_ROOT}/dokumenti/${id}`, data),
  deleteDokument: (id) => apiClient.delete(`${API_ROOT}/dokumenti/${id}`),

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
    return apiClient.post(`${API_ROOT}/ai/parse-pdf-contract`, formData);
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

  getHandoverProtocols: (contractId) =>
    apiClient.get(`${API_ROOT}/handover-protocols/contract/${contractId}`),
  createHandoverProtocol: (data) =>
    apiClient.post(`${API_ROOT}/handover-protocols`, data),
  updateHandoverProtocol: (id, data) =>
    apiClient.put(`${API_ROOT}/handover-protocols/${id}`, data),
  deleteHandoverProtocol: (id) =>
    apiClient.delete(`${API_ROOT}/handover-protocols/${id}`),

  getBackendUrl: getBackendUrl,

  // Tenant Members
  addTenantMember: (tenantId, data) =>
    api.post(`/tenants/${tenantId}/members`, data),
};

export const buildDocumentUrl = (dokument) => {
  if (!dokument || !dokument.putanja_datoteke) {
    return null;
  }
  return `${BACKEND_URL}/${dokument.putanja_datoteke}`;
};

export { API_ROOT as API };
