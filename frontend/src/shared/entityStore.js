import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import {
  api,
  getActiveTenantId,
  setActiveTenantId,
  subscribeToTenantChanges,
} from "./api";
import { sortUnitsByPosition } from "./units";

export const EntityStoreContext = React.createContext(null);

export const EntityStoreProvider = ({ children }) => {
  const [tenantId, setTenantId] = useState(() => getActiveTenantId());
  const [state, setState] = useState({
    nekretnine: [],
    zakupnici: [],
    ugovori: [],
    dokumenti: [],
    propertyUnits: [],
    maintenanceTasks: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToTenantChanges((nextTenantId) => {
      setTenantId(nextTenantId);
    });
    return unsubscribe;
  }, []);

  const fetchNekretnine = useCallback(async () => {
    try {
      const res = await api.getNekretnine();
      setState((prev) => ({ ...prev, nekretnine: res.data || [] }));
      const unitsRes = await api.getUnits();
      setState((prev) => ({ ...prev, propertyUnits: unitsRes.data || [] }));
    } catch (err) {
      console.error("Error fetching properties:", err);
    }
  }, []);

  const fetchZakupnici = useCallback(async () => {
    try {
      const res = await api.getZakupnici();
      setState((prev) => ({ ...prev, zakupnici: res.data || [] }));
    } catch (err) {
      console.error("Error fetching tenants:", err);
    }
  }, []);

  const fetchUgovori = useCallback(async () => {
    try {
      // Contracts need tenant names, so we might need tenants loaded or fetch them too.
      // For simplicity, let's just fetch contracts. If tenant names are missing,
      // the UI might show IDs or we rely on tenants being in state.
      // Actually, the original code mapped tenant names. Let's try to preserve that if possible.
      // But for background refresh, we might not want to re-fetch everything.
      // Let's stick to simple fetch for now, and rely on state having tenants.
      // Wait, if we add a contract for a NEW tenant, we need that tenant.
      // So fetching contracts might need to ensure tenants are fresh or fetch them.
      // The original code did Promise.all.

      const res = await api.getUgovori();
      const ugovoriData = res.data || [];

      // We need to map tenant names. We can use the CURRENT state of zakupnici.
      // But setState is functional.
      setState((prev) => {
        const enhancedUgovori = ugovoriData.map((ugovor) => {
          const zakupnik = prev.zakupnici.find(
            (z) => z.id === ugovor.zakupnik_id,
          );
          return {
            ...ugovor,
            zakupnik_naziv: zakupnik
              ? zakupnik.naziv_firme || zakupnik.ime_prezime || zakupnik.email
              : null,
          };
        });
        return { ...prev, ugovori: enhancedUgovori };
      });
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  }, []);

  const fetchDokumenti = useCallback(async () => {
    try {
      const res = await api.getDokumenti();
      setState((prev) => ({ ...prev, dokumenti: res.data || [] }));
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  }, []);

  const fetchMaintenanceTasks = useCallback(async () => {
    try {
      const res = await api.getMaintenanceTasks();
      setState((prev) => ({ ...prev, maintenanceTasks: res.data || [] }));
    } catch (err) {
      console.error("Error fetching maintenance tasks:", err);
    }
  }, []);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch using the new functions?
      // Issue: fetchUgovori depends on Zakupnici for mapping.
      // So we should fetch Zakupnici first or in parallel but handle mapping carefully.
      // The original code passed zakRes.data to ugovori mapping.

      // Let's reproduce the original singular fetch for the initial load for safety/speed,
      // OR just chain them.

      const [nekRes, zakRes, ugRes, dokRes, unitRes, maintenanceRes] =
        await Promise.all([
          api.getNekretnine(),
          api.getZakupnici(),
          api.getUgovori(),
          api.getDokumenti(),
          api.getUnits(),
          api.getMaintenanceTasks(),
        ]);

      const zakupniciData = zakRes.data || [];
      const ugovoriData = (ugRes.data || []).map((ugovor) => {
        const zakupnik = zakupniciData.find((z) => z.id === ugovor.zakupnik_id);
        return {
          ...ugovor,
          zakupnik_naziv: zakupnik
            ? zakupnik.naziv_firme || zakupnik.ime_prezime || zakupnik.email
            : null,
        };
      });

      setState({
        nekretnine: nekRes.data,
        zakupnici: zakupniciData,
        ugovori: ugovoriData,
        dokumenti: dokRes.data,
        propertyUnits: unitRes.data,
        maintenanceTasks: maintenanceRes.data,
      });
      setError(null);
    } catch (err) {
      console.error("Greška pri učitavanju entiteta:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Listener for auto-refresh events
  useEffect(() => {
    const handleMutation = (event) => {
      const resource = event.detail?.resource;
      console.log(`[EntityStore] Received mutation event for: ${resource}`);

      if (!resource) return;

      if (resource === "nekretnine") {
        fetchNekretnine();
      } else if (resource === "zakupnici") {
        fetchZakupnici();
        // If tenants change, contracts might need re-mapping? Maybe.
        // But usually we just care about the tenant list.
      } else if (resource === "ugovori") {
        fetchUgovori();
      } else if (resource === "dokumenti") {
        fetchDokumenti();
      } else if (resource === "maintenance") {
        fetchMaintenanceTasks();
      } else if (resource === "tenants") {
        // Tenant profiles might not affect global lists directly unless it's the current tenant info?
        // But maybe we should refresh users?
        // For now, let's refresh tenants just in case.
        fetchZakupnici();
      }
    };

    window.addEventListener("entity:mutation", handleMutation);
    return () => {
      window.removeEventListener("entity:mutation", handleMutation);
    };
  }, [
    fetchNekretnine,
    fetchZakupnici,
    fetchUgovori,
    fetchDokumenti,
    fetchMaintenanceTasks,
  ]);

  const refreshMaintenanceTasks = fetchMaintenanceTasks;

  const syncDocument = useCallback((document) => {
    if (!document || !document.id) {
      return;
    }
    setState((prev) => {
      const current = Array.isArray(prev.dokumenti) ? prev.dokumenti : [];
      const index = current.findIndex((item) => item?.id === document.id);
      const nextDocuments =
        index === -1 ? [document, ...current] : [...current];
      if (index !== -1) {
        nextDocuments[index] = { ...current[index], ...document };
      }
      return { ...prev, dokumenti: nextDocuments };
    });
  }, []);

  const syncMaintenanceTask = useCallback((task) => {
    if (!task || !task.id) {
      return;
    }
    setState((prev) => {
      const current = Array.isArray(prev.maintenanceTasks)
        ? prev.maintenanceTasks
        : [];
      let replaced = false;
      const nextTasks = current.map((item) => {
        if (item?.id === task.id) {
          replaced = true;
          return { ...item, ...task };
        }
        return item;
      });

      if (!replaced) {
        nextTasks.unshift(task);
      }

      return { ...prev, maintenanceTasks: nextTasks };
    });
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const propertyUnitsById = useMemo(() => {
    const map = {};
    for (const unit of state.propertyUnits) {
      if (unit && unit.id) {
        map[unit.id] = unit;
      }
    }
    return map;
  }, [state.propertyUnits]);

  const propertyUnitsByProperty = useMemo(() => {
    const map = {};
    for (const unit of state.propertyUnits) {
      if (!unit || !unit.nekretnina_id) {
        continue;
      }
      if (!map[unit.nekretnina_id]) {
        map[unit.nekretnina_id] = [];
      }
      map[unit.nekretnina_id].push(unit);
    }

    Object.entries(map).forEach(([key, collection]) => {
      map[key] = sortUnitsByPosition(collection);
    });

    return map;
  }, [state.propertyUnits]);

  const changeTenant = useCallback((nextTenantId) => {
    const resolved = setActiveTenantId(nextTenantId);
    setTenantId(resolved);
    return resolved;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      propertyUnitsById,
      propertyUnitsByProperty,
      loading,
      error,
      refresh: loadEntities,
      refreshMaintenanceTasks,
      syncDocument,
      syncMaintenanceTask,
      tenantId,
      changeTenant,
    }),
    [
      state,
      propertyUnitsById,
      propertyUnitsByProperty,
      loading,
      error,
      loadEntities,
      refreshMaintenanceTasks,
      syncDocument,
      syncMaintenanceTask,
      tenantId,
      changeTenant,
    ],
  );

  return (
    <EntityStoreContext.Provider value={value}>
      {children}
    </EntityStoreContext.Provider>
  );
};

export const useEntityStore = () => {
  const context = useContext(EntityStoreContext);
  if (!context) {
    throw new Error(
      "useEntityStore must be used within an EntityStoreProvider",
    );
  }
  return context;
};
