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

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
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

  const refreshMaintenanceTasks = useCallback(async () => {
    try {
      const response = await api.getMaintenanceTasks();
      setState((prev) => ({ ...prev, maintenanceTasks: response.data }));
    } catch (err) {
      console.error("Greška pri učitavanju radnih naloga:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    setState({
      nekretnine: [],
      zakupnici: [],
      ugovori: [],
      dokumenti: [],
      propertyUnits: [],
      maintenanceTasks: [],
    });
  }, [tenantId]);

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
