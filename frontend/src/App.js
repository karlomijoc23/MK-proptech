import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import { Button } from './components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Checkbox } from './components/ui/checkbox';
import { Progress } from './components/ui/progress';
import { toast } from 'sonner';
import { Home, Building, Users, FileText, DollarSign, Calendar, Plus, Eye, Edit, Trash2, Search, Bell, Download, Sparkles, ArrowRight, Printer, Phone, Mail, MapPin, Archive, ArchiveRestore, Wrench } from 'lucide-react';
import logoMain from './assets/riforma-logo.png';
import './App.css';

const getBackendUrl = () => {
  const envValue = process.env.REACT_APP_BACKEND_URL?.trim();
  if (envValue) {
    return envValue.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const derivedPort = port === '3000' ? '8000' : port;
    const portSegment = derivedPort ? `:${derivedPort}` : '';
    return `${protocol}//${hostname}${portSegment}`;
  }

  return 'http://localhost:8000';
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// API functions
const api = {
  // Nekretnine
  getNekretnine: () => axios.get(`${API}/nekretnine`),
  createNekretnina: (data) => axios.post(`${API}/nekretnine`, data),
  updateNekretnina: (id, data) => axios.put(`${API}/nekretnine/${id}`, data),
  deleteNekretnina: (id) => axios.delete(`${API}/nekretnine/${id}`),
  
  // Zakupnici
  getZakupnici: (params = {}) => axios.get(`${API}/zakupnici`, { params }),
  createZakupnik: (data) => axios.post(`${API}/zakupnici`, data),
  updateZakupnik: (id, data) => axios.put(`${API}/zakupnici/${id}`, data),
  
  // Ugovori
  getUgovori: () => axios.get(`${API}/ugovori`),
  createUgovor: (data) => axios.post(`${API}/ugovori`, data),
  updateUgovor: (id, data) => axios.put(`${API}/ugovori/${id}`, data),
  updateStatusUgovora: (id, status) => axios.put(`${API}/ugovori/${id}/status`, { novi_status: status }),
  
  // Dokumenti
  getDokumenti: () => axios.get(`${API}/dokumenti`),
  getDokumentiNekretnine: (id) => axios.get(`${API}/dokumenti/nekretnina/${id}`),
  getDokumentiZakupnika: (id) => axios.get(`${API}/dokumenti/zakupnik/${id}`),
  getDokumentiUgovora: (id) => axios.get(`${API}/dokumenti/ugovor/${id}`),
  getDokumentiPropertyUnit: (id) => axios.get(`${API}/dokumenti/property-unit/${id}`),
  createDokument: (data) => {
    const formData = new FormData();
    formData.append('naziv', data.naziv);
    formData.append('tip', data.tip);
    if (data.opis) {
      formData.append('opis', data.opis);
    }

    if (data.nekretnina_id) {
      formData.append('nekretnina_id', data.nekretnina_id);
    }
    if (data.zakupnik_id) {
      formData.append('zakupnik_id', data.zakupnik_id);
    }
    if (data.ugovor_id) {
      formData.append('ugovor_id', data.ugovor_id);
    }
    if (data.property_unit_id) {
      formData.append('property_unit_id', data.property_unit_id);
    }
    if (data.file) {
      formData.append('file', data.file);
    }

    return axios.post(`${API}/dokumenti`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Podprostori / jedinice
  getUnits: (params = {}) => axios.get(`${API}/units`, { params }),
  getUnitsForProperty: (propertyId) => axios.get(`${API}/nekretnine/${propertyId}/units`),
  getUnit: (unitId) => axios.get(`${API}/units/${unitId}`),
  createUnit: (propertyId, payload) => axios.post(`${API}/nekretnine/${propertyId}/units`, payload),
  updateUnit: (unitId, payload) => axios.put(`${API}/units/${unitId}`, payload),
  deleteUnit: (unitId) => axios.delete(`${API}/units/${unitId}`),
  bulkUpdateUnits: (payload) => axios.post(`${API}/units/bulk-update`, payload),

  // Dashboard
  getDashboard: () => axios.get(`${API}/dashboard`),
  
  // Podsjećanja
  getPodsjetnici: () => axios.get(`${API}/podsjetnici`),
  getAktivniPodsjetnici: () => axios.get(`${API}/podsjetnici/aktivni`),
  
  // AI PDF parsing
  parsePdfContract: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/ai/parse-pdf-contract`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Maintenance
  getMaintenanceTasks: (params = {}) => axios.get(`${API}/maintenance-tasks`, { params }),
  getMaintenanceTask: (id) => axios.get(`${API}/maintenance-tasks/${id}`),
  createMaintenanceTask: (payload) => axios.post(`${API}/maintenance-tasks`, payload),
  updateMaintenanceTask: (id, payload) => axios.patch(`${API}/maintenance-tasks/${id}`, payload),
  deleteMaintenanceTask: (id) => axios.delete(`${API}/maintenance-tasks/${id}`),
  addMaintenanceComment: (id, payload) => axios.post(`${API}/maintenance-tasks/${id}/comments`, payload),

  // Podsjetnici actions
  markReminderAsSent: (id) => axios.put(`${API}/podsjetnici/${id}/oznaci-poslan`),
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalised = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '');
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatCurrency = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return '—';
  }
  return `${numeric.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

const formatArea = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return '—';
  }
  return `${numeric.toLocaleString('hr-HR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²`;
};

const formatPercentage = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} %`;
};

const formatDeltaPercentage = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const rounded = value.toFixed(1);
  const sign = value > 0 ? '+' : '';
  return `${sign}${rounded} %`;
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('hr-HR');
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('hr-HR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPropertyType = (value) => {
  if (!value) {
    return 'Nepoznata vrsta';
  }
  const map = {
    poslovna_zgrada: 'Poslovna zgrada',
    stan: 'Stan',
    zemljiste: 'Zemljište',
    ostalo: 'Ostalo',
  };
  return map[value] || value;
};



const UNIT_STATUS_CONFIG = {
  dostupno: {
    label: 'Dostupno',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  rezervirano: {
    label: 'Rezervirano',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  iznajmljeno: {
    label: 'Iznajmljeno',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
  },
  u_odrzavanju: {
    label: 'U održavanju',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
  },
};

const MAINTENANCE_STATUS_META = {
  novi: {
    title: 'Novi',
    description: 'Prijave koje čekaju trijažu',
    cardBorderClass: 'border-l-4 border-sky-500',
    badgeClass: 'border border-sky-200 bg-sky-100 text-sky-700',
  },
  planiran: {
    title: 'Planiran',
    description: 'Termin i resursi su definirani',
    cardBorderClass: 'border-l-4 border-amber-500',
    badgeClass: 'border border-amber-200 bg-amber-100 text-amber-700',
  },
  u_tijeku: {
    title: 'U tijeku',
    description: 'Radovi su u tijeku',
    cardBorderClass: 'border-l-4 border-blue-500',
    badgeClass: 'border border-blue-200 bg-blue-100 text-blue-700',
  },
  ceka_dobavljaca: {
    title: 'Čeka dobavljača',
    description: 'Blokirano dok ne stigne dobavljač',
    cardBorderClass: 'border-l-4 border-purple-500',
    badgeClass: 'border border-purple-200 bg-purple-100 text-purple-700',
  },
  potrebna_odluka: {
    title: 'Potrebna odluka',
    description: 'Čeka odobrenje ili dodatni input',
    cardBorderClass: 'border-l-4 border-rose-500',
    badgeClass: 'border border-rose-200 bg-rose-100 text-rose-700',
  },
  zavrseno: {
    title: 'Završeno',
    description: 'Radni nalog je izvršen',
    cardBorderClass: 'border-l-4 border-emerald-500',
    badgeClass: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
  },
  arhivirano: {
    title: 'Arhivirano',
    description: 'Ostavljeno za evidenciju',
    cardBorderClass: 'border-l-4 border-slate-400',
    badgeClass: 'border border-slate-200 bg-slate-100 text-slate-600',
  },
};

const MAINTENANCE_STATUS_ORDER = ['novi', 'planiran', 'u_tijeku', 'ceka_dobavljaca', 'potrebna_odluka', 'zavrseno'];
const ALL_MAINTENANCE_STATUSES = [...MAINTENANCE_STATUS_ORDER, 'arhivirano'];

const MAINTENANCE_PRIORITY_CONFIG = {
  nisko: {
    label: 'Nizak prioritet',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  srednje: {
    label: 'Srednji prioritet',
    className: 'border border-sky-200 bg-sky-50 text-sky-700',
  },
  visoko: {
    label: 'Visok prioritet',
    className: 'border border-orange-200 bg-orange-50 text-orange-700',
  },
  kriticno: {
    label: 'Kritično',
    className: 'border border-red-200 bg-red-50 text-red-700',
  },
};

const MAINTENANCE_PRIORITY_ORDER = ['kriticno', 'visoko', 'srednje', 'nisko'];

const EMPTY_MAINTENANCE_FORM = {
  naziv: '',
  opis: '',
  prioritet: 'srednje',
  status: 'novi',
  nekretnina_id: '',
  property_unit_id: '',
  prijavio: '',
  dodijeljeno: '',
  rok: '',
  oznake: '',
};


const formatUnitStatus = (status) => {
  if (!status) {
    return 'Nepoznato';
  }
  return UNIT_STATUS_CONFIG[status]?.label || status;
};

const getUnitStatusBadgeClass = (status) => UNIT_STATUS_CONFIG[status]?.badge || 'border-border bg-muted text-muted-foreground';
const getUnitStatusDotClass = (status) => UNIT_STATUS_CONFIG[status]?.dot || 'bg-muted-foreground/70';

const getUnitDisplayName = (unit) => {
  if (!unit) {
    return 'Nepoznata jedinica';
  }
  if (unit.naziv && unit.naziv.trim()) {
    return unit.naziv.trim();
  }
  if (unit.oznaka && unit.oznaka.trim()) {
    return unit.oznaka.trim();
  }
  return 'Nepoznata jedinica';
};

const computeUnitsSummary = (units = []) => {
  const summary = {
    total: units.length,
    leased: 0,
    reserved: 0,
    available: 0,
    maintenance: 0,
  };

  units.forEach((unit) => {
    switch (unit?.status) {
      case 'iznajmljeno':
        summary.leased += 1;
        break;
      case 'rezervirano':
        summary.reserved += 1;
        break;
      case 'u_odrzavanju':
        summary.maintenance += 1;
        break;
      case 'dostupno':
      default:
        summary.available += 1;
        break;
    }
  });

  summary.occupancy = summary.total ? (summary.leased / summary.total) * 100 : 0;
  summary.vacancy = summary.total ? (summary.available / summary.total) * 100 : 0;
  return summary;
};

const sortUnitsByPosition = (units = []) => {
  return [...units].sort((a, b) => {
    const floorCompare = (a.kat || '').localeCompare(b.kat || '');
    if (floorCompare !== 0) {
      return floorCompare;
    }
    return (a.oznaka || '').localeCompare(b.oznaka || '');
  });
};

const convertUnitDraftToPayload = (unitDraft = {}) => {
  const trimOrNull = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const payload = {
    oznaka: trimOrNull(unitDraft.oznaka) || '',
    naziv: trimOrNull(unitDraft.naziv),
    kat: trimOrNull(unitDraft.kat),
    povrsina_m2: parseNumericValue(unitDraft.povrsina_m2),
    status: unitDraft.status || 'dostupno',
    osnovna_zakupnina: parseNumericValue(unitDraft.osnovna_zakupnina),
    zakupnik_id: unitDraft.zakupnik_id || null,
    ugovor_id: unitDraft.ugovor_id || null,
    raspolozivo_od: unitDraft.raspolozivo_od || null,
    layout_ref: trimOrNull(unitDraft.layout_ref),
    napomena: trimOrNull(unitDraft.napomena),
    opis: trimOrNull(unitDraft.opis),
    metadata: unitDraft.metadata || null,
  };

  return payload;
};

const normaliseNekretninaPayload = (formPayload = {}) => {
  const property = { ...(formPayload.nekretnina || {}) };
  const units = Array.isArray(formPayload.units)
    ? formPayload.units
        .map((unit) => convertUnitDraftToPayload(unit))
        .filter((unit) => unit.oznaka)
    : [];

  return { property, units };
};

const resolveUnitTenantName = (unit, tenantsById) => {
  if (!unit?.zakupnik_id) {
    return '—';
  }
  const tenant = tenantsById?.[unit.zakupnik_id];
  if (!tenant) {
    return 'Nepoznat zakupnik';
  }
  return tenant.naziv_firme || tenant.ime_prezime || 'Nepoznat zakupnik';
};

const formatBooleanish = (value) => {
  if (value === true || value === 'DA') {
    return 'Da';
  }
  if (value === false || value === 'NE') {
    return 'Ne';
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value;
};

const getRiskBadges = (nekretnina) => {
  const badges = [];
  if (nekretnina?.sudski_sporovi) {
    badges.push({ label: 'Spor', variant: 'destructive' });
  }
  if (nekretnina?.hipoteke) {
    badges.push({ label: 'Hipoteka', variant: 'secondary' });
  }
  if (nekretnina?.napomene) {
    badges.push({ label: 'Napomena', variant: 'outline' });
  }
  return badges;
};

const buildDocumentUrl = (dokument) => {
  if (!dokument || !dokument.putanja_datoteke) {
    return null;
  }
  return `${BACKEND_URL}/${dokument.putanja_datoteke}`;
};

const DocumentViewer = ({ dokument, heightClass = 'h-[60vh] md:h-[72vh]' }) => {
  if (!dokument || !dokument.putanja_datoteke) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 text-sm text-muted-foreground/80`}>
        PDF nije dostupan. Preuzmite datoteku putem opcije ispod.
      </div>
    );
  }

  const viewerUrl = `${buildDocumentUrl(dokument)}#toolbar=0&view=FitH`;

  return (
    <div data-document-preview className={`w-full overflow-hidden rounded-xl border border-border/60 bg-white shadow-inner ${heightClass}`}>
      <object data={viewerUrl} type="application/pdf" className="h-full w-full" style={{ border: 'none' }}>
        <iframe
          src={viewerUrl}
          title={`Pregled: ${dokument.naziv}`}
          className="h-full w-full"
          loading="lazy"
          style={{ border: 'none' }}
        />
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground/80">
          Pregled nije podržan u ovom pregledniku. Koristite gumb za otvaranje u novom prozoru.
        </div>
      </object>
    </div>
  );
};

const DOCUMENT_TYPE_LABELS = {
  ugovor: 'Ugovor',
  aneks: 'Aneks',
  certifikat: 'Certifikat',
  osiguranje: 'Osiguranje',
  zemljisnoknjizni_izvadak: 'Zemljišnoknjižni izvadak',
  uporabna_dozvola: 'Uporabna dozvola',
  gradevinska_dozvola: 'Građevinska dozvola',
  energetski_certifikat: 'Energetski certifikat',
  izvadak_iz_registra: 'Izvadak iz registra',
  bon_2: 'BON-2',
  racun: 'Račun',
  procjena_vrijednosti: 'Procjena vrijednosti',
  lokacijska_informacija: 'Lokacijska informacija',
  ostalo: 'Ostalo',
};

const formatDocumentType = (tip) => DOCUMENT_TYPE_LABELS[tip] || tip;

const PROPERTY_DOCUMENT_TYPES = new Set([
  'gradevinska_dozvola',
  'uporabna_dozvola',
  'energetski_certifikat',
  'zemljisnoknjizni_izvadak',
  'izvadak_iz_registra',
  'procjena_vrijednosti',
  'lokacijska_informacija',
  'certifikat',
  'osiguranje',
]);

const CONTRACT_DOCUMENT_TYPES = new Set(['ugovor', 'aneks', 'racun', 'bon_2']);

const DOCUMENT_TYPE_ALIASES = {
  ugovor_o_zakupu: 'ugovor',
  lease_agreement: 'ugovor',
  contract: 'ugovor',
  aneks_ugovora: 'aneks',
  annex: 'aneks',
  invoice: 'racun',
  bill: 'racun',
  building_permit: 'gradevinska_dozvola',
  construction_permit: 'gradevinska_dozvola',
  usage_permit: 'uporabna_dozvola',
  location_information: 'lokacijska_informacija',
  location_permit: 'lokacijska_informacija',
  property_valuation: 'procjena_vrijednosti',
  valuation: 'procjena_vrijednosti',
  energy_certificate: 'energetski_certifikat',
  land_registry_extract: 'zemljisnoknjizni_izvadak',
  register_extract: 'izvadak_iz_registra',
  insurance_policy: 'osiguranje',
  certificate: 'certifikat',
};

const normaliseDocumentTypeKey = (value) => {
  if (!value) {
    return '';
  }
  return value.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
};

const resolveDocumentType = (value) => {
  const key = normaliseDocumentTypeKey(value);
  if (!key) {
    return 'ugovor';
  }
  if (DOCUMENT_TYPE_ALIASES[key]) {
    return DOCUMENT_TYPE_ALIASES[key];
  }
  if (PROPERTY_DOCUMENT_TYPES.has(key) || CONTRACT_DOCUMENT_TYPES.has(key) || key === 'certifikat' || key === 'ostalo') {
    return key;
  }
  return 'ostalo';
};

const InfoField = ({ label, value, fallback = '—' }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
      {label}
    </p>
    <p className="text-sm font-medium text-foreground">{value ?? fallback}</p>
  </div>
);

const ARCHIVED_CONTRACT_STATUSES = new Set(['arhivirano', 'raskinuto']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dedupeRemindersById = (items = []) => {
  const map = new Map();
  for (const reminder of items || []) {
    if (!reminder || reminder.id === undefined || reminder.id === null) {
      continue;
    }
    const existing = map.get(reminder.id);
    if (!existing) {
      map.set(reminder.id, reminder);
      continue;
    }
    const currentDate = reminder.datum_podsjetnika ? new Date(reminder.datum_podsjetnika).getTime() : Number.POSITIVE_INFINITY;
    const existingDate = existing.datum_podsjetnika ? new Date(existing.datum_podsjetnika).getTime() : Number.POSITIVE_INFINITY;
    if (currentDate < existingDate) {
      map.set(reminder.id, reminder);
    }
  }
  return Array.from(map.values());
};

const EntityStoreContext = React.createContext(null);

const EntityStoreProvider = ({ children }) => {
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

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const [nekRes, zakRes, ugRes, dokRes, unitRes, maintenanceRes] = await Promise.all([
        api.getNekretnine(),
        api.getZakupnici(),
        api.getUgovori(),
        api.getDokumenti(),
        api.getUnits(),
        api.getMaintenanceTasks(),
      ]);

      setState({
        nekretnine: nekRes.data,
        zakupnici: zakRes.data,
        ugovori: ugRes.data,
        dokumenti: dokRes.data,
        propertyUnits: unitRes.data,
        maintenanceTasks: maintenanceRes.data,
      });
      setError(null);
    } catch (err) {
      console.error('Greška pri učitavanju entiteta:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMaintenanceTasks = useCallback(async () => {
    try {
      const response = await api.getMaintenanceTasks();
      setState((prev) => ({ ...prev, maintenanceTasks: response.data }));
    } catch (err) {
      console.error('Greška pri učitavanju radnih naloga:', err);
    }
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

  const value = useMemo(() => ({
    ...state,
    propertyUnitsById,
    propertyUnitsByProperty,
    loading,
    error,
    refresh: loadEntities,
    refreshMaintenanceTasks,
  }), [state, propertyUnitsById, propertyUnitsByProperty, loading, error, loadEntities, refreshMaintenanceTasks]);

  return (
    <EntityStoreContext.Provider value={value}>
      {children}
    </EntityStoreContext.Provider>
  );
};

const useEntityStore = () => {
  const context = useContext(EntityStoreContext);
  if (!context) {
    throw new Error('useEntityStore must be used within an EntityStoreProvider');
  }
  return context;
};

// Navigation Component
const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/nekretnine', icon: Building, label: 'Nekretnine' },
    { path: '/zakupnici', icon: Users, label: 'Zakupnici' },
    { path: '/ugovori', icon: Calendar, label: 'Ugovori' },
    { path: '/odrzavanje', icon: Wrench, label: 'Održavanje' },
    { path: '/dokumenti', icon: FileText, label: 'Dokumenti' },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-3">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoMain}
            alt="Riforma"
            className="w-32 h-auto sm:w-44 lg:w-52"
          />
        </Link>

        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-6">
          <div className="flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>AI Copilot Ready</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/80 bg-white/80 p-1 shadow-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-accent/20 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Clickable Reminder Component
const ClickableReminder = ({ podsjetnik }) => {
  const navigate = useNavigate();
  const [ugovorDetails, setUgovorDetails] = useState(null);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);

  useEffect(() => {
    fetchUgovorDetails();
  }, []);

  const fetchUgovorDetails = async () => {
    try {
      const [ugovorRes, nekretnineRes, zakupniciRes] = await Promise.all([
        api.getUgovori(),
        api.getNekretnine(), 
        api.getZakupnici()
      ]);
      
      const ugovor = ugovorRes.data.find(u => u.id === podsjetnik.ugovor_id);
      const nekretnina = nekretnineRes.data.find(n => n.id === ugovor?.nekretnina_id);
      const zakupnik = zakupniciRes.data.find(z => z.id === ugovor?.zakupnik_id);
      
      setUgovorDetails({ ugovor, nekretnina, zakupnik });
    } catch (error) {
      console.error('Greška pri dohvaćanju detalja ugovora:', error);
    }
  };

  const handleReminderClick = () => {
    if (podsjetnik.tip === 'istek_ugovora') {
      setShowRenewalDialog(true);
    }
  };

  const handleRenewContract = async (godina) => {
    try {
      if (!ugovorDetails?.ugovor) return;
      
      const trenutniUgovor = ugovorDetails.ugovor;
      const noviDatumPocetka = new Date(trenutniUgovor.datum_zavrsetka);
      const noviDatumZavrsetka = new Date(trenutniUgovor.datum_zavrsetka);
      noviDatumZavrsetka.setFullYear(noviDatumZavrsetka.getFullYear() + godina);
      
      // Pripremi podatke za novi ugovor i otvori formu
      const noviUgovorTemplate = {
        interna_oznaka: `${trenutniUgovor.interna_oznaka}-PROD-${godina}G`,
        nekretnina_id: trenutniUgovor.nekretnina_id,
        zakupnik_id: trenutniUgovor.zakupnik_id,
        datum_potpisivanja: new Date().toISOString().split('T')[0],
        datum_pocetka: noviDatumPocetka.toISOString().split('T')[0],
        datum_zavrsetka: noviDatumZavrsetka.toISOString().split('T')[0],
        trajanje_mjeseci: godina * 12,
        rok_otkaza_dani: trenutniUgovor.rok_otkaza_dani,
        osnovna_zakupnina: trenutniUgovor.osnovna_zakupnina * (1 + 0.03 * godina), // 3% godišnje povećanje
        zakupnina_po_m2: trenutniUgovor.zakupnina_po_m2 ? trenutniUgovor.zakupnina_po_m2 * (1 + 0.03 * godina) : null,
        cam_troskovi: trenutniUgovor.cam_troskovi,
        polog_depozit: trenutniUgovor.polog_depozit,
        garancija: trenutniUgovor.garancija,
        indeksacija: trenutniUgovor.indeksacija,
        indeks: trenutniUgovor.indeks,
        formula_indeksacije: trenutniUgovor.formula_indeksacije,
        obveze_odrzavanja: trenutniUgovor.obveze_odrzavanja,
        namjena_prostora: trenutniUgovor.namjena_prostora,
        rezije_brojila: trenutniUgovor.rezije_brojila,
        _isRenewal: true,
        _oldContractId: trenutniUgovor.id
      };
      
      // Spremi template u sessionStorage i preusmjeri
      sessionStorage.setItem('renewalTemplate', JSON.stringify(noviUgovorTemplate));
      setShowRenewalDialog(false);
      navigate('/ugovori?action=renew');
    } catch (error) {
      console.error('Greška pri pripremi produška ugovora:', error);
      toast.error('Greška pri pripremi produžetka ugovora');
    }
  };

  if (!ugovorDetails) {
    return (
      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
        <div>
          <p className="font-medium">Učitava podsjećanje...</p>
        </div>
        <Badge variant="secondary">Učitava</Badge>
      </div>
    );
  }

  const getPriorityColor = (dani) => {
    if (dani <= 30) return 'border border-red-200 bg-red-50 hover:bg-red-100';
    if (dani <= 60) return 'border border-amber-200 bg-amber-50 hover:bg-amber-100';
    return 'border border-primary/30 bg-primary/5 hover:bg-primary/10';
  };

  const getPriorityBadge = (dani) => {
    if (dani <= 30) {
      return <Badge className="border-none bg-red-100 text-red-700">Hitno</Badge>;
    }
    if (dani <= 60) {
      return <Badge className="border-none bg-amber-100 text-amber-700">Priprema</Badge>;
    }
    return <Badge className="border-none bg-primary/10 text-primary">Informativno</Badge>;
  };

  return (
    <>
      <div
        className={`flex items-center justify-between rounded-2xl p-4 transition-all ${getPriorityColor(podsjetnik.dani_prije)}`}
        onClick={handleReminderClick}
        data-testid={`clickable-reminder-${podsjetnik.id}`}
      >
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-semibold tracking-wide text-primary">
              {podsjetnik.tip === 'istek_ugovora' ? 'ISTEK UGOVORA' : podsjetnik.tip.toUpperCase()}
            </h4>
            {getPriorityBadge(podsjetnik.dani_prije)}
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">
              <span role="img" aria-hidden="true">📋</span> {ugovorDetails.ugovor?.interna_oznaka}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">🏢</span> {ugovorDetails.nekretnina?.naziv} - {ugovorDetails.nekretnina?.adresa}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">👤</span> {ugovorDetails.zakupnik?.naziv_firme || ugovorDetails.zakupnik?.ime_prezime}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">📅</span> Ističe: {new Date(ugovorDetails.ugovor?.datum_zavrsetka).toLocaleDateString()}
              <span className="ml-2 font-semibold text-red-600">
                (za {podsjetnik.dani_prije} dana)
              </span>
            </p>
            <p className="text-sm font-semibold text-primary">
              <span role="img" aria-hidden="true">💰</span> {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()} €/mjesec
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Pokreni radnju</div>
          <div className="space-y-1">
            <Button 
              variant="default" 
              size="sm"
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                handleReminderClick();
              }}
            >
              Riješi <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full rounded-full border-primary/20 text-xs text-primary hover:bg-primary/10"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await api.markReminderAsSent(podsjetnik.id);
                  toast.success('Podsjetnik je označen kao riješen');
                  // Refresh dashboard
                  window.location.reload();
                } catch (error) {
                  console.error('Greška pri označavanju podsjetnika:', error);
                  toast.error('Greška pri označavanju podsjetnika');
                }
              }}
              data-testid={`mark-resolved-${podsjetnik.id}`}
            >
              ✓ Riješeno
            </Button>
          </div>
        </div>
      </div>

      {/* Renewal Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="renewal-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Produžetak ugovora - {ugovorDetails.ugovor?.interna_oznaka}
            </DialogTitle>
          </DialogHeader>
          <div id="renewal-dialog-description" className="sr-only">
            Dialog za produžetak ugovora s opcijama 1, 2 ili 5 godina
          </div>

          <div className="space-y-6">
            {/* Contract details */}
            <div className="rounded-2xl border border-border/60 bg-primary/5 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Detalji trenutnog ugovora
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-foreground/90">
                <div>
                  <span className="font-semibold text-primary">Nekretnina:</span> {ugovorDetails.nekretnina?.naziv}
                </div>
                <div>
                  <span className="font-semibold text-primary">Zakupnik:</span> {ugovorDetails.zakupnik?.naziv_firme || ugovorDetails.zakupnik?.ime_prezime}
                </div>
                <div>
                  <span className="font-semibold text-primary">Trenutna kirija:</span> {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()} €
                </div>
                <div>
                  <span className="font-semibold text-primary">Ističe:</span> {new Date(ugovorDetails.ugovor?.datum_zavrsetka).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Renewal options */}
            <div>
              <h3 className="font-medium mb-4">Izaberite opciju produžetka:</h3>
              <div className="grid grid-cols-1 gap-3">
                
                <Card 
                  className="cursor-pointer border border-border/60 transition-all hover:border-primary/60 hover:bg-primary/10"
                  onClick={() => handleRenewContract(1)}
                  data-testid="renewal-option-1-year"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">1 Godina</h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.03).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Povećanje: 3% (standardno)</p>
                      </div>
                      <Badge variant="default" className="rounded-full bg-primary text-primary-foreground">Standardno</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer border border-accent/60 transition-all hover:border-accent hover:bg-accent/15"
                  onClick={() => handleRenewContract(2)}
                  data-testid="renewal-option-2-years"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">2 Godine</h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.06).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Povećanje: 6% (3% godišnje x 2)</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full border-none bg-accent text-primary-foreground">Preporučeno</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer border border-border/60 transition-all hover:border-primary/60 hover:bg-primary/10"
                  onClick={() => handleRenewContract(5)}
                  data-testid="renewal-option-5-years"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">5 Godina</h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija: {((ugovorDetails.ugovor?.osnovna_zakupnina || 0) * 1.15).toLocaleString()} €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Povećanje: 15% (3% godišnje x 5)</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-primary/40 text-primary">Dugoročno</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowRenewalDialog(false)}
                className="flex-1"
                data-testid="cancel-renewal"
              >
                Otkaži
              </Button>
              <Button 
                variant="default"
                onClick={() => navigate('/ugovori')}
                className="flex-1"
                data-testid="go-to-contracts"
              >
                Idi na ugovore
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Dashboard Component
const MaintenanceBoard = ({
  enableFilters = false,
  enableList = false,
  enableDetails = true,
  title = 'Radni nalozi održavanja',
  description = 'Kanban pregled naloga kako bi odjel upravljanja nekretninama imao jasan uvid.',
}) => {
  const {
    maintenanceTasks,
    nekretnine,
    propertyUnitsById,
    propertyUnitsByProperty,
    refreshMaintenanceTasks,
    loading: storeLoading,
  } = useEntityStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_MAINTENANCE_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    prioritet: 'all',
    nekretnina: 'all',
    status: 'all',
    dueFrom: '',
    dueTo: '',
    oznaka: '',
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentForm, setCommentForm] = useState({ author: '', message: '' });
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const propertyMap = useMemo(() => {
    const map = {};
    for (const property of nekretnine) {
      if (property?.id) {
        map[property.id] = property;
      }
    }
    return map;
  }, [nekretnine]);

  const filteredTasks = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    const labelTerms = filters.oznaka
      ? filters.oznaka
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : [];
    let dueFromDate = filters.dueFrom ? new Date(filters.dueFrom) : null;
    let dueToDate = filters.dueTo ? new Date(filters.dueTo) : null;

    if (dueFromDate && Number.isNaN(dueFromDate.getTime())) {
      dueFromDate = null;
    }
    if (dueToDate && Number.isNaN(dueToDate.getTime())) {
      dueToDate = null;
    }
    if (dueToDate) {
      dueToDate.setHours(23, 59, 59, 999);
    }

    return (maintenanceTasks || []).filter((task) => {
      if (filters.prioritet !== 'all' && task.prioritet !== filters.prioritet) {
        return false;
      }
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false;
      }
      if (filters.nekretnina !== 'all' && task.nekretnina_id !== filters.nekretnina) {
        return false;
      }

      const dueDate = task.rok ? new Date(task.rok) : null;
      const dueValid = dueDate && !Number.isNaN(dueDate.getTime());
      if (dueFromDate && (!dueValid || dueDate < dueFromDate)) {
        return false;
      }
      if (dueToDate && (!dueValid || dueDate > dueToDate)) {
        return false;
      }

      if (labelTerms.length > 0) {
        const labels = (task.oznake || []).map((item) => item.toLowerCase());
        const matchesLabels = labelTerms.every((term) => labels.some((label) => label.includes(term)));
        if (!matchesLabels) {
          return false;
        }
      }

      if (searchTerm) {
        const property = propertyMap[task.nekretnina_id];
        const haystack = [
          task.naziv,
          task.opis,
          task.prijavio,
          task.dodijeljeno,
          property?.naziv,
          property?.adresa,
          ...(task.oznake || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [maintenanceTasks, filters, propertyMap]);

  const groupedTasks = useMemo(() => {
    const buckets = {};
    for (const status of ALL_MAINTENANCE_STATUSES) {
      buckets[status] = [];
    }
    for (const task of filteredTasks || []) {
      const bucket = buckets[task.status] || (buckets[task.status] = []);
      bucket.push(task);
    }
    Object.values(buckets).forEach((items) => {
      items.sort((a, b) => {
        const firstDue = a.rok ? new Date(a.rok) : null;
        const secondDue = b.rok ? new Date(b.rok) : null;
        const firstDueValue = firstDue && !Number.isNaN(firstDue.getTime()) ? firstDue.getTime() : Number.POSITIVE_INFINITY;
        const secondDueValue = secondDue && !Number.isNaN(secondDue.getTime()) ? secondDue.getTime() : Number.POSITIVE_INFINITY;
        if (firstDueValue !== secondDueValue) {
          return firstDueValue - secondDueValue;
        }
        const firstUpdated = new Date(a.azuriran || a.kreiran || 0).getTime();
        const secondUpdated = new Date(b.azuriran || b.kreiran || 0).getTime();
        return secondUpdated - firstUpdated;
      });
    });
    return buckets;
  }, [filteredTasks]);

  const columns = useMemo(() => (
    MAINTENANCE_STATUS_ORDER.map((status) => ({
      status,
      meta: MAINTENANCE_STATUS_META[status],
      tasks: groupedTasks[status] || [],
    }))
  ), [groupedTasks]);

  const archivedTasks = groupedTasks.arhivirano || [];

  const getPriorityRank = (value) => {
    const index = MAINTENANCE_PRIORITY_ORDER.indexOf(value);
    return index === -1 ? MAINTENANCE_PRIORITY_ORDER.length : index;
  };

  const listRows = useMemo(() => {
    const rows = [...(filteredTasks || [])];
    rows.sort((a, b) => {
      const dueValue = (task) => {
        if (!task.rok) {
          return Number.POSITIVE_INFINITY;
        }
        const parsed = new Date(task.rok);
        return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
      };

      const firstDue = dueValue(a);
      const secondDue = dueValue(b);
      if (firstDue !== secondDue) {
        return firstDue - secondDue;
      }

      const priorityDiff = getPriorityRank(a.prioritet) - getPriorityRank(b.prioritet);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const firstUpdated = new Date(a.azuriran || a.kreiran || 0).getTime();
      const secondUpdated = new Date(b.azuriran || b.kreiran || 0).getTime();
      return secondUpdated - firstUpdated;
    });
    return rows;
  }, [filteredTasks]);

  const unitsForSelectedProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return [];
    }
    return propertyUnitsByProperty[formData.nekretnina_id] || [];
  }, [formData.nekretnina_id, propertyUnitsByProperty]);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_MAINTENANCE_FORM);
  }, []);

  const handleDialogOpenChange = useCallback((open) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  }, [resetForm]);

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!formData.naziv.trim()) {
      toast.error('Naziv radnog naloga je obavezan');
      return;
    }
    setIsSubmitting(true);
    try {
      const normaliseRelation = (value) => {
        if (!value || value === 'none') {
          return undefined;
        }
        return value;
      };

      const payload = {
        naziv: formData.naziv.trim(),
        opis: formData.opis.trim() || undefined,
        prioritet: formData.prioritet,
        status: formData.status,
        nekretnina_id: normaliseRelation(formData.nekretnina_id),
        property_unit_id: normaliseRelation(formData.property_unit_id),
        prijavio: formData.prijavio.trim() || undefined,
        dodijeljeno: formData.dodijeljeno.trim() || undefined,
        rok: formData.rok || undefined,
        oznake: formData.oznake
          ? formData.oznake.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      };
      await api.createMaintenanceTask(payload);
      toast.success('Radni nalog je dodan');
      handleDialogOpenChange(false);
      await refreshMaintenanceTasks();
    } catch (error) {
      console.error('Greška pri kreiranju radnog naloga:', error);
      const message = error.response?.data?.detail || 'Greška pri kreiranju naloga';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchTaskDetails = useCallback(async (taskId) => {
    setDetailLoading(true);
    try {
      const response = await api.getMaintenanceTask(taskId);
      setSelectedTask(response.data);
      return response.data;
    } catch (error) {
      console.error('Greška pri dohvaćanju detalja radnog naloga:', error);
      toast.error('Greška pri dohvaćanju detalja naloga');
      throw error;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCardClick = useCallback((task) => {
    if (!enableDetails) {
      return;
    }
    setSelectedTaskId(task.id);
    setSelectedTask(task);
    setDetailOpen(true);
    fetchTaskDetails(task.id);
  }, [enableDetails, fetchTaskDetails]);

  const handleDetailOpenChange = useCallback((open) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedTaskId(null);
      setSelectedTask(null);
      setCommentForm({ author: '', message: '' });
    }
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      prioritet: 'all',
      nekretnina: 'all',
      status: 'all',
      dueFrom: '',
      dueTo: '',
      oznaka: '',
    });
  }, []);

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTaskId) {
      return;
    }
    if (!commentForm.message.trim()) {
      toast.error('Komentar ne može biti prazan');
      return;
    }
    setCommentSubmitting(true);
    try {
      await api.addMaintenanceComment(selectedTaskId, {
        poruka: commentForm.message.trim(),
        autor: commentForm.author.trim() || undefined,
      });
      toast.success('Komentar je dodan');
      setCommentForm({ author: '', message: '' });
      await refreshMaintenanceTasks();
      await fetchTaskDetails(selectedTaskId);
    } catch (error) {
      console.error('Greška pri dodavanju komentara:', error);
      const message = error.response?.data?.detail || 'Greška pri dodavanju komentara';
      toast.error(message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const activityItems = useMemo(() => {
    if (!selectedTask || !selectedTask.aktivnosti) {
      return [];
    }
    return [...selectedTask.aktivnosti].sort((a, b) => {
      const first = new Date(a.timestamp || a.vrijeme || a.created_at || 0).getTime();
      const second = new Date(b.timestamp || b.vrijeme || b.created_at || 0).getTime();
      return second - first;
    });
  }, [selectedTask]);

  const activityLabels = {
    kreiran: 'Nalog kreiran',
    promjena_statusa: 'Promjena statusa',
    komentar: 'Komentar',
    uredjeno: 'Ažuriranje naloga',
  };

  const handleStatusChange = useCallback(async (taskId, nextStatus) => {
    setStatusUpdating(taskId);
    try {
      await api.updateMaintenanceTask(taskId, { status: nextStatus });
      toast.success('Status radnog naloga je ažuriran');
      await refreshMaintenanceTasks();
      if (enableDetails && selectedTaskId === taskId) {
        await fetchTaskDetails(taskId);
      }
    } catch (error) {
      console.error('Greška pri promjeni statusa naloga:', error);
      const message = error.response?.data?.detail || 'Ažuriranje statusa nije uspjelo';
      toast.error(message);
    } finally {
      setStatusUpdating(null);
    }
  }, [refreshMaintenanceTasks, enableDetails, selectedTaskId, fetchTaskDetails]);

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const isLoading = storeLoading && maintenanceTasks.length === 0;

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search.trim() ||
      filters.oznaka.trim() ||
      filters.prioritet !== 'all' ||
      filters.status !== 'all' ||
      filters.nekretnina !== 'all' ||
      filters.dueFrom ||
      filters.dueTo
    );
  }, [filters]);

  const renderTaskCard = useCallback((task) => {
    const statusMeta = MAINTENANCE_STATUS_META[task.status] || {};
    const priorityMeta = MAINTENANCE_PRIORITY_CONFIG[task.prioritet] || MAINTENANCE_PRIORITY_CONFIG.srednje;
    const property = propertyMap[task.nekretnina_id];
    const unit = propertyUnitsById?.[task.property_unit_id];
    const dueDate = task.rok ? new Date(task.rok) : null;
    const validDueDate = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
    const overdue = validDueDate && validDueDate < today && !['zavrseno', 'arhivirano'].includes(task.status);
    const statusLabel = statusMeta.title || task.status;
    const dueLabel = task.rok ? formatDate(task.rok) : 'Bez roka';
    const isCompleted = task.status === 'zavrseno' || task.status === 'arhivirano';

    const cardClasses = [
      'border border-border/60 shadow-sm',
      statusMeta.cardBorderClass || '',
      enableDetails ? 'cursor-pointer transition hover:border-primary/60' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Card
        key={task.id}
        className={cardClasses}
        onClick={() => {
          if (enableDetails) {
            handleCardClick(task);
          }
        }}
        role={enableDetails ? 'button' : undefined}
      >
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">{task.naziv}</CardTitle>
              <p className="text-xs text-muted-foreground/80">
                {property ? property.naziv : 'Nepovezana nekretnina'}
                {unit ? ` • ${unit.naziv || unit.oznaka || unit.id}` : ''}
              </p>
            </div>
            <Badge variant="outline" className={statusMeta.badgeClass || 'border border-border bg-muted text-muted-foreground'}>
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {task.opis && <p className="text-sm text-muted-foreground">{task.opis}</p>}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/90">
            <Badge variant="outline" className={priorityMeta.className}>
              {priorityMeta.label}
            </Badge>
            <div className={`flex items-center gap-1 ${overdue ? 'font-semibold text-red-600' : ''}`}>
              <Calendar className="h-3.5 w-3.5" />
              <span>{dueLabel}</span>
            </div>
            {task.prijavio && (
              <span>Prijavio: <span className="font-medium text-foreground">{task.prijavio}</span></span>
            )}
            {task.dodijeljeno && (
              <span>Dodijeljeno: <span className="font-medium text-foreground">{task.dodijeljeno}</span></span>
            )}
          </div>

          {task.oznake && task.oznake.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.oznake.map((label) => (
                <Badge key={label} variant="outline" className="border-dashed border-border/50 text-muted-foreground">
                  #{label}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Select
              value={task.status}
              onValueChange={(value) => handleStatusChange(task.id, value)}
              disabled={statusUpdating === task.id}
            >
              <SelectTrigger className="h-8 w-full" onClick={(event) => event.stopPropagation()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_MAINTENANCE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {MAINTENANCE_STATUS_META[status]?.title || status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {!isCompleted && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleStatusChange(task.id, 'zavrseno');
                  }}
                  disabled={statusUpdating === task.id}
                >
                  Označi dovršeno
                </Button>
              )}
              {task.status !== 'arhivirano' && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleStatusChange(task.id, 'arhivirano');
                  }}
                  disabled={statusUpdating === task.id}
                  title="Arhiviraj nalog"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [enableDetails, handleCardClick, handleStatusChange, propertyMap, propertyUnitsById, statusUpdating, today]);

  return (
    <section className="space-y-4" id="maintenance-board">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" onClick={handleOpenDialog} className="md:w-auto" data-testid="add-maintenance-task">
          <Plus className="mr-2 h-4 w-4" /> Dodaj radni nalog
        </Button>
      </div>

      {enableFilters && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Filteri i pretraga</h3>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
                Poništi filtre
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label htmlFor="maintenance-search">Pretraži naloge</Label>
              <Input
                id="maintenance-search"
                value={filters.search}
                onChange={(event) => handleFilterChange('search', event.target.value)}
                placeholder="npr. klima, lift, hitno"
              />
            </div>
            <div>
              <Label htmlFor="maintenance-prioritet-filter">Prioritet</Label>
              <Select
                value={filters.prioritet}
                onValueChange={(value) => handleFilterChange('prioritet', value)}
              >
                <SelectTrigger id="maintenance-prioritet-filter">
                  <SelectValue placeholder="Svi prioriteti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi prioriteti</SelectItem>
                  {Object.entries(MAINTENANCE_PRIORITY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maintenance-status-filter">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger id="maintenance-status-filter">
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  {ALL_MAINTENANCE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {MAINTENANCE_STATUS_META[status]?.title || status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="maintenance-property-filter">Nekretnina</Label>
              <Select
                value={filters.nekretnina}
                onValueChange={(value) => handleFilterChange('nekretnina', value)}
              >
                <SelectTrigger id="maintenance-property-filter">
                  <SelectValue placeholder="Sve nekretnine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve nekretnine</SelectItem>
                  {nekretnine.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="maintenance-label-filter">Oznake</Label>
              <Input
                id="maintenance-label-filter"
                value={filters.oznaka}
                onChange={(event) => handleFilterChange('oznaka', event.target.value)}
                placeholder="npr. elektrika, servis"
              />
            </div>
            <div>
              <Label htmlFor="maintenance-due-from">Rok od</Label>
              <Input
                id="maintenance-due-from"
                type="date"
                value={filters.dueFrom}
                onChange={(event) => handleFilterChange('dueFrom', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="maintenance-due-to">Rok do</Label>
              <Input
                id="maintenance-due-to"
                type="date"
                value={filters.dueTo}
                onChange={(event) => handleFilterChange('dueTo', event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/80">
            Prikazano {filteredTasks.length} od {maintenanceTasks.length} naloga.
          </p>
        </div>
      )}


      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {columns.map(({ status, meta, tasks }) => (
            <div key={status} className="w-72 flex-shrink-0">
              <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{meta?.title || status}</h3>
                    <p className="text-xs text-muted-foreground/80">{meta?.description}</p>
                  </div>
                  <Badge variant="outline" className={meta?.badgeClass || 'border border-border text-muted-foreground'}>
                    {tasks.length}
                  </Badge>
                </div>
                <div className="space-y-3 pt-3">
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground/70">Učitavam radne naloge…</p>
                  ) : tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">Nema naloga u ovoj fazi.</p>
                  ) : (
                    tasks.map((task) => renderTaskCard(task))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {archivedTasks.length > 0 && (
        <details className="rounded-lg border border-border/60 bg-white/80 p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arhivirani nalozi ({archivedTasks.length})
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedTasks.map((task) => renderTaskCard(task))}
          </div>
        </details>
      )}

      {enableList && (
        <div className="rounded-xl border border-border/60 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Popis naloga</h3>
              <p className="text-xs text-muted-foreground">Detaljni pregled s mogućnošću brzog otvaranja timeline prikaza.</p>
            </div>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {listRows.length}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Nalog</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Prioritet</th>
                  <th className="px-4 py-2 text-left font-semibold">Nekretnina</th>
                  <th className="px-4 py-2 text-left font-semibold">Rok</th>
                  <th className="px-4 py-2 text-left font-semibold">Dodijeljeno</th>
                  <th className="px-4 py-2 text-right font-semibold">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {listRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-sm text-muted-foreground">
                      Trenutno nema naloga koji odgovaraju odabranim filtrima.
                    </td>
                  </tr>
                ) : (
                  listRows.map((task) => {
                    const statusMeta = MAINTENANCE_STATUS_META[task.status] || {};
                    const priorityMeta = MAINTENANCE_PRIORITY_CONFIG[task.prioritet] || MAINTENANCE_PRIORITY_CONFIG.srednje;
                    const property = propertyMap[task.nekretnina_id];
                    const dueDate = task.rok ? new Date(task.rok) : null;
                    const validDueDate = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
                    const overdue = validDueDate && validDueDate < today && !['zavrseno', 'arhivirano'].includes(task.status);

                    return (
                      <tr key={task.id} className="transition hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{task.naziv}</span>
                            {task.opis && <span className="text-xs text-muted-foreground">{task.opis}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={statusMeta.badgeClass || 'border border-border text-muted-foreground'}>
                            {statusMeta.title || task.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={priorityMeta.className}>
                            {priorityMeta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {property ? property.naziv : 'Nepovezana'}
                        </td>
                        <td className={`px-4 py-3 ${overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                          {task.rok ? formatDate(task.rok) : 'Bez roka'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.dodijeljeno || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleCardClick(task)}>
                            Detalji
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.naziv || 'Detalji radnog naloga'}</DialogTitle>
            {selectedTask && (
              <p className="text-sm text-muted-foreground">
                {(MAINTENANCE_STATUS_META[selectedTask.status]?.title || selectedTask.status)} • {(MAINTENANCE_PRIORITY_CONFIG[selectedTask.prioritet]?.label || 'Prioritet')}
              </p>
            )}
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Učitavam detalje naloga…</p>
          ) : selectedTask ? (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Nekretnina</p>
                  <p className="text-sm text-foreground">{propertyMap[selectedTask.nekretnina_id]?.naziv || 'Nije povezano'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Podprostor</p>
                  <p className="text-sm text-foreground">
                    {propertyUnitsById?.[selectedTask.property_unit_id]?.naziv ||
                      propertyUnitsById?.[selectedTask.property_unit_id]?.oznaka ||
                      'Nije odabrano'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Prijavio</p>
                  <p className="text-sm text-foreground">{selectedTask.prijavio || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Dodijeljeno</p>
                  <p className="text-sm text-foreground">{selectedTask.dodijeljeno || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Rok</p>
                  <p className="text-sm text-foreground">{selectedTask.rok ? formatDate(selectedTask.rok) : 'Bez roka'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                  <Select
                    value={selectedTask.status}
                    onValueChange={(value) => handleStatusChange(selectedTask.id, value)}
                    disabled={statusUpdating === selectedTask.id}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_MAINTENANCE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {MAINTENANCE_STATUS_META[status]?.title || status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTask.oznake && selectedTask.oznake.length > 0 && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Oznake</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTask.oznake.map((label) => (
                        <Badge key={label} variant="outline" className="border-dashed border-border/50 text-muted-foreground">
                          #{label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedTask.opis && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Opis naloga</h4>
                  <p className="text-sm text-muted-foreground">{selectedTask.opis}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Timeline aktivnosti</h4>
                {activityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Još nema zabilježenih aktivnosti za ovaj nalog.</p>
                ) : (
                  <ul className="space-y-3">
                    {activityItems.map((activity) => {
                      const label = activityLabels[activity.tip] || activity.tip;
                      const statusLabel = activity.status ? (MAINTENANCE_STATUS_META[activity.status]?.title || activity.status) : null;
                      const timestamp = formatDateTime(activity.timestamp || activity.vrijeme || activity.created_at);
                      return (
                        <li key={activity.id} className="relative flex gap-3">
                          <div className="mt-1 h-full w-px bg-border" aria-hidden />
                          <div className="flex-1 rounded-lg border border-border/60 bg-white/80 p-3 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-border text-muted-foreground">{label}</Badge>
                                {statusLabel && (
                                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                    {statusLabel}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{timestamp}</span>
                            </div>
                            {activity.autor && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Autor: <span className="font-medium text-foreground">{activity.autor}</span>
                              </p>
                            )}
                            {activity.opis && (
                              <p className="mt-2 text-sm text-foreground">{activity.opis}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Dodaj komentar</h4>
                <form onSubmit={handleCommentSubmit} className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="comment-author">Autor komentara</Label>
                      <Input
                        id="comment-author"
                        value={commentForm.author}
                        onChange={(event) => setCommentForm((prev) => ({ ...prev, author: event.target.value }))}
                        placeholder="npr. Voditelj održavanja"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="comment-message">Komentar *</Label>
                      <Textarea
                        id="comment-message"
                        rows={3}
                        value={commentForm.message}
                        onChange={(event) => setCommentForm((prev) => ({ ...prev, message: event.target.value }))}
                        placeholder="Zapišite ažuriranje, dogovoreni termin ili povratnu informaciju izvođača"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCommentForm({ author: '', message: '' })}
                      disabled={commentSubmitting}
                    >
                      Poništi
                    </Button>
                    <Button type="submit" size="sm" disabled={commentSubmitting}>
                      {commentSubmitting ? 'Spremam…' : 'Dodaj komentar'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Detalji naloga nisu dostupni.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dodaj radni nalog</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Zabilježite sve potrebne aktivnosti kako bi tim mogao reagirati na vrijeme.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-naziv">Naziv naloga *</Label>
                <Input
                  id="task-naziv"
                  value={formData.naziv}
                  onChange={(event) => setFormData((prev) => ({ ...prev, naziv: event.target.value }))}
                  placeholder="npr. Servis klima uređaja"
                  required
                />
              </div>
              <div>
                <Label htmlFor="task-prioritet">Prioritet</Label>
                <Select
                  value={formData.prioritet}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, prioritet: value }))}
                >
                  <SelectTrigger id="task-prioritet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINTENANCE_PRIORITY_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MAINTENANCE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {MAINTENANCE_STATUS_META[status]?.title || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-rok">Rok izvedbe</Label>
                <Input
                  id="task-rok"
                  type="date"
                  value={formData.rok}
                  onChange={(event) => setFormData((prev) => ({ ...prev, rok: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-nekretnina">Nekretnina</Label>
                <Select
                  value={formData.nekretnina_id || 'none'}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      nekretnina_id: value === 'none' ? '' : value,
                      property_unit_id: '',
                    }))
                  }
                >
                  <SelectTrigger id="task-nekretnina">
                    <SelectValue placeholder="Odaberite nekretninu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez povezivanja</SelectItem>
                    {nekretnine.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.naziv}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-unit">Podprostor</Label>
                <Select
                  value={formData.property_unit_id || 'none'}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      property_unit_id: value === 'none' ? '' : value,
                    }))
                  }
                  disabled={!formData.nekretnina_id || unitsForSelectedProperty.length === 0}
                >
                  <SelectTrigger id="task-unit">
                    <SelectValue placeholder={formData.nekretnina_id ? 'Odaberite podprostor' : 'Prvo odaberite nekretninu'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez podprostora</SelectItem>
                    {unitsForSelectedProperty.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.oznaka || unit.naziv || unit.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-prijavio">Prijavio</Label>
                <Input
                  id="task-prijavio"
                  value={formData.prijavio}
                  onChange={(event) => setFormData((prev) => ({ ...prev, prijavio: event.target.value }))}
                  placeholder="npr. Ana Perić"
                />
              </div>
              <div>
                <Label htmlFor="task-dodijeljeno">Voditelj naloga</Label>
                <Input
                  id="task-dodijeljeno"
                  value={formData.dodijeljeno}
                  onChange={(event) => setFormData((prev) => ({ ...prev, dodijeljeno: event.target.value }))}
                  placeholder="npr. Voditelj održavanja"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="task-opis">Opis naloga</Label>
              <Textarea
                id="task-opis"
                value={formData.opis}
                onChange={(event) => setFormData((prev) => ({ ...prev, opis: event.target.value }))}
                rows={4}
                placeholder="Detaljan opis problema, potrebni materijali ili upute za izvođača"
              />
            </div>

            <div>
              <Label htmlFor="task-oznake">Oznake</Label>
              <Input
                id="task-oznake"
                value={formData.oznake}
                onChange={(event) => setFormData((prev) => ({ ...prev, oznake: event.target.value }))}
                placeholder="npr. elektrika, hitno"
              />
              <p className="mt-1 text-xs text-muted-foreground">Razdvojite oznake zarezom kako biste brže filtrirali zadatke.</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={isSubmitting}>
                Odustani
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Spremam…' : 'Spremi nalog'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const MaintenanceWorkspace = () => {
  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">Održavanje</h1>
        <p className="text-sm text-muted-foreground">
          Centralizirani pregled radnih naloga, timeline aktivnosti i popis svih zadataka.
        </p>
      </div>
      <MaintenanceBoard
        enableFilters
        enableList
        title="Kanban i popis radnih naloga"
        description="Filtrirajte, pratite timeline aktivnosti i upravljajte komentarima na jednom mjestu."
      />
    </div>
  );
};

const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [activeReminders, setActiveReminders] = useState([]);
  const [allReminders, setAllReminders] = useState([]);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [remindersFilter, setRemindersFilter] = useState('svi');
  const [reminderSearch, setReminderSearch] = useState('');
  const { dokumenti, nekretnine, ugovori, zakupnici } = useEntityStore();

  useEffect(() => {
    fetchDashboard();
    fetchActiveReminders();
    fetchAllReminders();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju dashboard podataka:', error);
      toast.error('Greška pri učitavanju dashboard-a');
    }
  };

  const fetchActiveReminders = async () => {
    try {
      const response = await api.getAktivniPodsjetnici();
      setActiveReminders(dedupeRemindersById(response.data));
    } catch (error) {
      console.error('Greška pri dohvaćanju podsjećanja:', error);
    }
  };

  const fetchAllReminders = async () => {
    try {
      const response = await api.getPodsjetnici();
      setAllReminders(dedupeRemindersById(response.data));
    } catch (error) {
      console.error('Greška pri dohvaćanju podsjećanja:', error);
    }
  };

  const getReminderLabel = (tip) => {
    const labels = {
      istek_ugovora: 'Istek ugovora',
      obnova_garancije: 'Obnova garancije',
      indeksacija: 'Indeksacija',
    };
    return labels[tip] || tip;
  };

  const rentalCapacity = dashboard?.najamni_kapacitet || null;

  const getReminderContext = useCallback((reminder) => {
    if (!reminder) {
      return { contract: null, property: null, tenant: null };
    }

    const contract = ugovori?.find((item) => item.id === reminder.ugovor_id) || null;
    const property = contract ? nekretnine?.find((item) => item.id === contract.nekretnina_id) || null : null;
    const tenant = contract ? zakupnici?.find((item) => item.id === contract.zakupnik_id) || null : null;

    return { contract, property, tenant };
  }, [ugovori, nekretnine, zakupnici]);

  const isReminderValid = useCallback((reminder) => {
    if (!reminder) {
      return false;
    }

    const { contract } = getReminderContext(reminder);
    if (!contract) {
      return false;
    }

    if (ARCHIVED_CONTRACT_STATUSES.has(contract.status)) {
      return false;
    }

    if (reminder.tip === 'istek_ugovora') {
      if (!contract.datum_zavrsetka) {
        return false;
      }

      const expiry = new Date(contract.datum_zavrsetka);
      if (Number.isNaN(expiry.getTime())) {
        return false;
      }

      const today = new Date();
      const daysUntil = Math.ceil((expiry - today) / MS_PER_DAY);
      const rawLead = reminder?.dani_prije;
      const lead = rawLead === null || rawLead === undefined || rawLead === ''
        ? null
        : Number(rawLead);

      if (lead !== null && Number.isFinite(lead)) {
        const windowUpper = lead + 7;
        const windowLower = Math.max(lead - 7, 0);
        if (daysUntil > windowUpper || daysUntil < windowLower) {
          return false;
        }
      } else {
        const allowedLead = 7;
        if (daysUntil > allowedLead) {
          return false;
        }
      }

      if (daysUntil < -14) {
        return false;
      }

      if (reminder.datum_podsjetnika) {
        const reminderDate = new Date(reminder.datum_podsjetnika);
        if (!Number.isNaN(reminderDate.getTime())) {
          const expected = new Date(expiry);
          expected.setDate(expected.getDate() - (reminder.dani_prije ?? 0));
          if (Math.abs(reminderDate.getTime() - expected.getTime()) > MS_PER_DAY * 2) {
            return false;
          }
        }
      }
    }

    return true;
  }, [getReminderContext]);

  const sanitizedActiveReminders = useMemo(
    () => activeReminders.filter(isReminderValid),
    [activeReminders, isReminderValid]
  );

  const sanitizedAllReminders = useMemo(
    () => allReminders.filter(isReminderValid),
    [allReminders, isReminderValid]
  );

  const upcomingReminders = useMemo(() => {
    return [...sanitizedActiveReminders]
      .sort((a, b) => new Date(a.datum_podsjetnika) - new Date(b.datum_podsjetnika))
      .slice(0, 5);
  }, [sanitizedActiveReminders]);

  const totalReminders = sanitizedAllReminders.length;
  const activeRemindersCount = sanitizedActiveReminders.length;
  const sentRemindersCount = useMemo(
    () => sanitizedAllReminders.filter((reminder) => reminder.poslan).length,
    [sanitizedAllReminders]
  );
  const highPriorityCount = useMemo(
    () => sanitizedActiveReminders.filter((reminder) => reminder.dani_prije <= 30).length,
    [sanitizedActiveReminders]
  );

  useEffect(() => {
    if (!showAllReminders) {
      setRemindersFilter('svi');
      setReminderSearch('');
    }
  }, [showAllReminders]);

  const filteredAllReminders = useMemo(() => {
    const base = [...sanitizedAllReminders].sort((a, b) => new Date(a.datum_podsjetnika || 0) - new Date(b.datum_podsjetnika || 0));
    return base.filter((reminder) => {
      if (remindersFilter === 'aktivni' && reminder.poslan) {
        return false;
      }
      if (remindersFilter === 'poslani' && !reminder.poslan) {
        return false;
      }
      if (remindersFilter === 'visok' && (reminder.dani_prije === undefined || reminder.dani_prije > 30)) {
        return false;
      }
      if (reminderSearch.trim()) {
        const query = reminderSearch.toLowerCase();
        const { contract, property, tenant } = getReminderContext(reminder);
        const haystack = [
          getReminderLabel(reminder.tip),
          contract?.interna_oznaka,
          property?.naziv,
          property?.adresa,
          tenant?.naziv_firme,
          tenant?.ime_prezime,
          tenant?.oib,
          reminder.datum_podsjetnika ? new Date(reminder.datum_podsjetnika).toLocaleDateString('hr-HR') : null,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [sanitizedAllReminders, remindersFilter, reminderSearch, getReminderContext]);

  const revenueSeries = dashboard?.series?.monthly_revenue ?? [];

  const portfolioBreakdown = useMemo(() => {
    const entries = Array.isArray(dashboard?.portfolio_breakdown) ? [...dashboard.portfolio_breakdown] : [];
    return entries.sort((a, b) => {
      const valueA = parseNumericValue(a.total_value) || 0;
      const valueB = parseNumericValue(b.total_value) || 0;
      return valueB - valueA;
    });
  }, [dashboard?.portfolio_breakdown]);

  const formatCurrency = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '—';
    }
    return numeric.toLocaleString('hr-HR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  if (!dashboard) {
    return <div className="p-8 text-sm text-muted-foreground">Učitavam kontrolni centar…</div>;
  }

  const monthlyRevenueSeries = revenueSeries
    .map((point) => ({
      month: point?.month,
      value: typeof point?.value === 'number' ? point.value : Number(point?.value ?? 0),
    }))
    .filter((point) => Number.isFinite(point.value));
  const currentMonthlyRevenueRaw = dashboard.mjesecni_prihod ?? (monthlyRevenueSeries.at(-1)?.value ?? 0);
  const currentMonthlyRevenue = Number.isFinite(Number(currentMonthlyRevenueRaw)) ? Number(currentMonthlyRevenueRaw) : 0;
  const previousMonthlyRevenue = monthlyRevenueSeries.length > 1 ? monthlyRevenueSeries.at(-2).value : null;

  let monthlyRevenueTrend = 'Nema podataka za usporedbu.';
  if (typeof previousMonthlyRevenue === 'number') {
    if (previousMonthlyRevenue === 0) {
      monthlyRevenueTrend = currentMonthlyRevenue === 0
        ? 'Prihod je nepromijenjen u odnosu na prošli mjesec.'
        : 'Prihod je ostvaren prvi put u odnosu na prošli mjesec.';
    } else {
      const deltaPercent = ((currentMonthlyRevenue - previousMonthlyRevenue) / previousMonthlyRevenue) * 100;
      const formattedDelta = deltaPercent.toFixed(1);
      monthlyRevenueTrend = deltaPercent >= 0
        ? `+${formattedDelta}% u odnosu na prošli mjesec.`
        : `${formattedDelta}% u odnosu na prošli mjesec.`;
    }
  }

  const summaryCards = [
    {
      id: 'ukupno-nekretnina-card',
      label: 'Ukupno nekretnina',
      icon: Building,
      value: dashboard.ukupno_nekretnina,
    },
    {
      id: 'aktivni-ugovori-card',
      label: 'Aktivni ugovori',
      icon: Calendar,
      value: dashboard.aktivni_ugovori,
    },
    {
      id: 'ugovori-na-isteku-card',
      label: 'Ugovori na isteku',
      icon: Bell,
      value: dashboard.ugovori_na_isteku,
    },
    {
      id: 'mjesecni-prihod-card',
      label: 'Mjesecni prihod',
      icon: FileText,
      value: formatCurrency(currentMonthlyRevenue),
      suffix: ' €',
      sublabel: monthlyRevenueTrend,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 md:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-primary">Kontrolni centar</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pratite vrijednost portfelja, uvjete zakupa i dokaze o usklađenosti iz jednog AI-kontroliranog sučelja.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90">
            <Link to="/nekretnine">
              Dodaj novu nekretninu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ id, label, icon: Icon, value, sublabel, suffix }) => (
          <Card key={id} data-testid={id} className="card-hover shadow-shell">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
                <Icon className="h-5 w-5 text-primary/70" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="truncate text-3xl font-semibold text-foreground">
                {value}
                {suffix ? <span className="ml-1 text-base font-medium text-muted-foreground">{suffix}</span> : null}
              </div>
              {sublabel && <p className="mt-1 text-xs font-medium text-muted-foreground/80">{sublabel}</p>}
            </CardContent>
          </Card>
        ))}

        <Card data-testid="vrijednost-portfelja-card" className="border-0 bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">Vrijednost portfelja</CardTitle>
              <Building className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="truncate text-2xl font-bold">{dashboard.ukupna_vrijednost_portfelja?.toLocaleString()} €</div>
            <p className="text-xs text-white/80">Ukupna tržišna vrijednost</p>
          </CardContent>
        </Card>

        <Card data-testid="godisnji-prinos-card" className="border-0 bg-gradient-to-r from-accent to-primary text-white shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">Godišnji prinos</CardTitle>
              <DollarSign className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="truncate text-2xl font-bold">{dashboard.godisnji_prinos?.toLocaleString()} €</div>
            <p className="text-xs text-white/80">{dashboard.prinos_postotak}% ROI</p>
          </CardContent>
        </Card>
      </div>

      {rentalCapacity && (
        <Card className="shadow-shell" data-testid="rental-capacity-card">
          <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Najamni kapacitet</CardTitle>
              <p className="text-sm text-muted-foreground">
                Praćenje popunjenosti i raspoloživih podprostora u portfelju.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={Math.min(100, Math.max(0, rentalCapacity.occupancy_rate ?? 0))} className="w-36" />
              <span className="text-sm font-semibold text-foreground">
                {rentalCapacity.occupancy_rate != null ? formatPercentage(rentalCapacity.occupancy_rate) : '—'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ukupno jedinica</p>
                <p className="text-lg font-semibold text-foreground">{rentalCapacity.total_units ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Iznajmljeno</p>
                <p className="text-lg font-semibold text-foreground">{rentalCapacity.occupied_units ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dostupno</p>
                <p className="text-lg font-semibold text-foreground">{rentalCapacity.available_units ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rezervirano / pipeline</p>
                <p className="text-lg font-semibold text-foreground">{rentalCapacity.reserved_units ?? 0}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Top prazni podprostori</h4>
                {rentalCapacity.top_vacant_units && rentalCapacity.top_vacant_units.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rentalCapacity.top_vacant_units.map((unit) => (
                      <li key={unit.id} className="rounded-lg border border-border/50 bg-white/70 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{unit.naziv || unit.oznaka}</span>
                          <span>{unit.osnovna_zakupnina != null ? formatCurrency(unit.osnovna_zakupnina) : '—'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {unit.nekretnina_naziv || 'Nekretnina'} • {unit.povrsina_m2 ? `${unit.povrsina_m2} m²` : '—'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Trenutno nema praznih podprostora.</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Rezervacije i pipeline</h4>
                {rentalCapacity.pipeline_units && rentalCapacity.pipeline_units.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rentalCapacity.pipeline_units.map((unit) => (
                      <li key={unit.id} className="rounded-lg border border-border/50 bg-white/70 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{unit.naziv || unit.oznaka}</span>
                          <span>{unit.osnovna_zakupnina != null ? formatCurrency(unit.osnovna_zakupnina) : '—'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {unit.nekretnina_naziv || 'Nekretnina'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nema rezerviranih podprostora u pipelineu.</p>
                )}
              </div>
            </div>

            {rentalCapacity.by_property && rentalCapacity.by_property.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Popunjenost po nekretninama</h4>
                <div className="space-y-2">
                  {rentalCapacity.by_property.slice(0, 5).map((row) => (
                    <div key={row.nekretnina_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-white/70 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{row.naziv || 'Nekretnina'}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.iznajmljeno}/{row.ukupno} jedinica • {row.popunjenost != null ? formatPercentage(row.popunjenost) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, row.popunjenost ?? 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <MaintenanceBoard />

      {portfolioBreakdown.length > 0 && (
        <Card className="shadow-shell" data-testid="portfolio-breakdown">
          <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Segmenti portfelja</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sumarni pogled po vrsti nekretnine s vrijednošću, prinosom i popunjenošću.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Segment</th>
                    <th className="px-4 py-3 font-semibold">Nekretnina</th>
                    <th className="px-4 py-3 font-semibold">Površina</th>
                    <th className="px-4 py-3 font-semibold">Vrijednost</th>
                    <th className="px-4 py-3 font-semibold">Neto prihod</th>
                    <th className="px-4 py-3 font-semibold">Popunjenost</th>
                    <th className="px-4 py-3 font-semibold">Marža</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {portfolioBreakdown.map((row) => {
                    const gross = parseNumericValue(row.gross_income) || 0;
                    const net = parseNumericValue(row.net_income) || 0;
                    const margin = gross ? (net / Math.abs(gross)) * 100 : null;
                    return (
                      <tr key={row.type} className="transition hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium text-foreground">{formatPropertyType(row.type)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatArea(row.total_area)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatCurrency(row.total_value)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatCurrency(row.net_income)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.average_occupancy !== null ? formatPercentage(row.average_occupancy) : '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{margin !== null ? formatDeltaPercentage(margin) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <section id="podsjetnici" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Podsjećanja</h2>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {activeRemindersCount} aktivnih
          </Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Aktivna podsjećanja</CardTitle>
              <Bell className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {activeRemindersCount > 0 ? (
                <div className="space-y-3">
                  {upcomingReminders.map((reminder) => (
                    <ClickableReminder key={reminder.id} podsjetnik={reminder} />
                  ))}
                  {activeRemindersCount > upcomingReminders.length && (
                    <p className="text-xs text-muted-foreground/80">
                      Prikazano prvih {upcomingReminders.length} aktivnih podsjećanja.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/80">Trenutno nema aktivnih podsjećanja.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Statistika podsjećanja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Ukupno podsjećanja</span>
                    <span className="font-semibold text-foreground">{totalReminders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aktivna</span>
                    <span className="font-semibold text-orange-600">{activeRemindersCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Poslana</span>
                    <span className="font-semibold text-green-600">{sentRemindersCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Visok prioritet (≤30 dana)</span>
                    <span className="font-semibold text-red-600">{highPriorityCount}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllReminders(true)}
                  >
                    Pregledaj sve podsjećanja
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Sljedeći rokovi</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingReminders.length > 0 ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {upcomingReminders.map((reminder) => {
                      const { contract, property, tenant } = getReminderContext(reminder);
                      return (
                        <div key={reminder.id} className="border-l-4 border-blue-500 pl-3">
                          <p className="font-medium text-foreground">{getReminderLabel(reminder.tip)}</p>
                          {contract && (
                            <p className="text-xs text-muted-foreground">Ugovor: {contract.interna_oznaka}</p>
                          )}
                          {(property || tenant) && (
                            <p className="text-xs text-muted-foreground/80">
                              {(property && property.naziv) || 'Nepoznata nekretnina'} • {tenant?.naziv_firme || tenant?.ime_prezime || 'Nepoznat zakupnik'}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/80">
                            {new Date(reminder.datum_podsjetnika).toLocaleDateString()} ({reminder.dani_prije} dana prije)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/80">Nema nadolazećih podsjećanja.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showAllReminders} onOpenChange={setShowAllReminders}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" aria-describedby="sva-podsjetnici-opis">
            <DialogHeader>
              <DialogTitle>Podsjećanja ({filteredAllReminders.length}/{totalReminders})</DialogTitle>
            </DialogHeader>
            <div id="sva-podsjetnici-opis" className="sr-only">
              Detaljan popis svih podsjećanja s filtriranjem i pretraživanjem
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <Input
                  value={reminderSearch}
                  onChange={(e) => setReminderSearch(e.target.value)}
                  placeholder="Pretraži po ugovoru, nekretnini ili zakupniku..."
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'svi', label: 'Svi' },
                    { value: 'aktivni', label: 'Aktivni' },
                    { value: 'poslani', label: 'Poslani' },
                    { value: 'visok', label: 'Visok prioritet' },
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={remindersFilter === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRemindersFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredAllReminders.length === 0 ? (
                  <p className="text-sm text-muted-foreground/80">Nema podsjećanja za zadane filtere.</p>
                ) : (
                  filteredAllReminders.map((reminder) => {
                    const { contract, property, tenant } = getReminderContext(reminder);
                    const isSent = Boolean(reminder.poslan);
                    const isHighPriority = !isSent && reminder.dani_prije !== undefined && reminder.dani_prije <= 30;
                    return (
                      <Card key={reminder.id} className="border border-border/60">
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{getReminderLabel(reminder.tip)}</Badge>
                            {isSent ? (
                              <Badge variant="secondary">Poslano</Badge>
                            ) : isHighPriority ? (
                              <Badge variant="destructive">Visok prioritet</Badge>
                            ) : (
                              <Badge variant="outline">Aktivno</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/80">
                            {reminder.datum_podsjetnika
                              ? new Date(reminder.datum_podsjetnika).toLocaleDateString('hr-HR')
                              : 'Nepoznat datum'}
                            {reminder.dani_prije !== undefined && !Number.isNaN(reminder.dani_prije)
                              ? ` • ${reminder.dani_prije} dana prije`
                              : ''}
                          </p>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground">
                            Ugovor: {contract?.interna_oznaka || 'Nepoznat ugovor'}
                          </p>
                          <p>
                            Nekretnina: {property?.naziv || '—'}
                            {property?.adresa ? ` (${property.adresa})` : ''}
                          </p>
                          <p>
                            Zakupnik: {tenant?.naziv_firme || tenant?.ime_prezime || '—'}
                            {tenant?.oib ? ` • OIB: ${tenant.oib}` : ''}
                          </p>
                          {reminder.napomena && (
                            <p className="text-xs text-muted-foreground/80">Napomena: {reminder.napomena}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
};

const DEFAULT_UNIT_FORM = {
  id: null,
  oznaka: '',
  naziv: '',
  kat: '',
  povrsina_m2: '',
  status: 'dostupno',
  osnovna_zakupnina: '',
  zakupnik_id: '',
  ugovor_id: '',
  raspolozivo_od: '',
  layout_ref: '',
  napomena: '',
};

const PropertyUnitsPanel = ({ property, units = [], tenants = [], tenantsById = {}, contracts = [], onRefresh }) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [unitFormMode, setUnitFormMode] = useState('create');
  const [unitFormData, setUnitFormData] = useState({ ...DEFAULT_UNIT_FORM });
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitDetailOpen, setUnitDetailOpen] = useState(false);
  const [unitDetailId, setUnitDetailId] = useState(null);
  const [unitDocuments, setUnitDocuments] = useState([]);
  const [unitDocsLoading, setUnitDocsLoading] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ status: '', osnovna_zakupnina: '' });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set();
      for (const unit of units) {
        if (prev.has(unit.id)) {
          next.add(unit.id);
        }
      }
      return next;
    });
  }, [units, property?.id]);

  const summary = useMemo(() => computeUnitsSummary(units), [units]);
  const statusBreakdown = useMemo(() => ([
    { status: 'iznajmljeno', count: summary.leased },
    { status: 'rezervirano', count: summary.reserved },
    { status: 'dostupno', count: summary.available },
    { status: 'u_odrzavanju', count: summary.maintenance },
  ]), [summary]);

  const contractsById = useMemo(
    () => Object.fromEntries((contracts || []).map((contract) => [contract.id, contract])),
    [contracts]
  );

  const tenantOptions = useMemo(() => {
    return (tenants || []).slice().sort((a, b) => {
      const labelA = a.naziv_firme || a.ime_prezime || '';
      const labelB = b.naziv_firme || b.ime_prezime || '';
      return labelA.localeCompare(labelB, 'hr');
    });
  }, [tenants]);

  const unitStatusOptions = useMemo(
    () => Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => ({ value, label: config.label })),
    []
  );

  const selectedUnits = useMemo(() => units.filter((unit) => selectedIds.has(unit.id)), [units, selectedIds]);
  const resolvedUnitDetail = useMemo(() => {
    if (!unitDetailId) {
      return null;
    }
    return units.find((unit) => unit.id === unitDetailId) || null;
  }, [unitDetailId, units]);

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(units.map((unit) => unit.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleUnitSelection = (unitId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const resetForm = useCallback(() => {
    setUnitFormData({ ...DEFAULT_UNIT_FORM });
    setUnitFormMode('create');
  }, []);

  const openCreateForm = () => {
    resetForm();
    setUnitFormOpen(true);
  };

  const openEditForm = (unit) => {
    setUnitFormMode('edit');
    setUnitFormData({
      id: unit.id,
      oznaka: unit.oznaka || '',
      naziv: unit.naziv || '',
      kat: unit.kat || '',
      povrsina_m2: unit.povrsina_m2 ?? '',
      status: unit.status || 'dostupno',
      osnovna_zakupnina: unit.osnovna_zakupnina ?? '',
      zakupnik_id: unit.zakupnik_id || '',
      ugovor_id: unit.ugovor_id || '',
      raspolozivo_od: unit.raspolozivo_od ? new Date(unit.raspolozivo_od).toISOString().slice(0, 10) : '',
      layout_ref: unit.layout_ref || '',
      napomena: unit.napomena || '',
    });
    setUnitFormOpen(true);
  };

  const handleUnitFormChange = (field, value) => {
    setUnitFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildUnitPayload = () => {
    const payload = {
      oznaka: unitFormData.oznaka?.trim(),
      naziv: unitFormData.naziv?.trim() || null,
      kat: unitFormData.kat?.trim() || null,
      status: unitFormData.status || 'dostupno',
      osnovna_zakupnina:
        unitFormData.osnovna_zakupnina === '' ? null : parseNumericValue(unitFormData.osnovna_zakupnina),
      zakupnik_id: unitFormData.zakupnik_id || null,
      ugovor_id: unitFormData.ugovor_id || null,
      raspolozivo_od: unitFormData.raspolozivo_od || null,
      layout_ref: unitFormData.layout_ref?.trim() || null,
      napomena: unitFormData.napomena?.trim() || null,
    };

    if (unitFormData.povrsina_m2 !== '') {
      payload.povrsina_m2 = parseNumericValue(unitFormData.povrsina_m2);
    }

    if (!payload.oznaka) {
      throw new Error('Identifikator jedinice je obavezan.');
    }

    return payload;
  };

  const refreshAndCloseForm = async () => {
    if (onRefresh) {
      await onRefresh();
    }
    setUnitFormOpen(false);
    resetForm();
  };

  const submitUnitForm = async () => {
    try {
      const payload = buildUnitPayload();
      setUnitSubmitting(true);
      if (unitFormMode === 'create') {
        await api.createUnit(property.id, payload);
        toast.success('Podprostor je dodan.');
      } else if (unitFormData.id) {
        await api.updateUnit(unitFormData.id, payload);
        toast.success('Podprostor je ažuriran.');
      }
      await refreshAndCloseForm();
    } catch (error) {
      console.error('Neuspjelo spremanje jedinice:', error);
      toast.error(error?.message || 'Spremanje jedinice nije uspjelo.');
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit) => {
    const confirmed = window.confirm(`Obrisati jedinicu "${getUnitDisplayName(unit)}"?`);
    if (!confirmed) {
      return;
    }
    try {
      await api.deleteUnit(unit.id);
      toast.success('Podprostor je obrisan.');
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Neuspjelo brisanje jedinice:', error);
      toast.error(error?.response?.data?.detail || 'Brisanje nije uspjelo.');
    }
  };

  const loadUnitDocuments = async (unitId) => {
    setUnitDocsLoading(true);
    try {
      const response = await api.getDokumentiPropertyUnit(unitId);
      setUnitDocuments(response.data || []);
    } catch (error) {
      console.error('Greška pri dohvaćanju dokumenata jedinice:', error);
      setUnitDocuments([]);
      toast.error('Dokumenti jedinice nisu dostupni.');
    } finally {
      setUnitDocsLoading(false);
    }
  };

  const openUnitDetail = (unit) => {
    setUnitDetailId(unit.id);
    setUnitDetailOpen(true);
    loadUnitDocuments(unit.id);
  };

  const closeUnitDetail = () => {
    setUnitDetailOpen(false);
    setUnitDetailId(null);
    setUnitDocuments([]);
  };

  const applyBulkUpdates = async () => {
    if (!selectedIds.size) {
      toast.error('Odaberite podprostore za masovno ažuriranje.');
      return;
    }

    const payload = {};
    if (bulkForm.status) {
      payload.status = bulkForm.status;
    }
    if (bulkForm.osnovna_zakupnina !== '') {
      payload.osnovna_zakupnina = parseNumericValue(bulkForm.osnovna_zakupnina);
    }

    if (!Object.keys(payload).length) {
      toast.error('Navedite barem jednu promjenu za bulk ažuriranje.');
      return;
    }

    try {
      setBulkSubmitting(true);
      await api.bulkUpdateUnits({
        unit_ids: Array.from(selectedIds),
        updates: payload,
      });
      toast.success('Masovno ažuriranje je dovršeno.');
      setBulkDialogOpen(false);
      setBulkForm({ status: '', osnovna_zakupnina: '' });
      setSelectedIds(new Set());
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Neuspjelo masovno ažuriranje:', error);
      toast.error('Masovno ažuriranje nije uspjelo.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const resolveContractLabel = (unit) => {
    if (!unit?.ugovor_id) {
      return '—';
    }
    const contract = contractsById[unit.ugovor_id];
    if (!contract) {
      return 'Nepoznat ugovor';
    }
    const statusLabel = contract.status ? contract.status.toString() : '';
    return `${contract.interna_oznaka || 'Ugovor'}${statusLabel ? ` (${statusLabel})` : ''}`;
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">Pregled podprostora</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ukupno {summary.total} jedinica • {summary.leased} iznajmljeno • {summary.available} dostupno
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-3">
              <div className="w-40">
                <Progress value={summary.total ? Math.min(100, Math.max(0, summary.occupancy)) : 0} />
              </div>
              <span className="text-sm font-semibold text-foreground">
                {summary.total ? formatPercentage(summary.occupancy) : '—'} popunjeno
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusBreakdown.map(({ status, count }) => (
                <Badge key={status} variant="outline" className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(status)}`}>
                  {formatUnitStatus(status)}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} odabranih jedinica` : 'Odaberite jedinice za bulk radnje'}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" /> Dodaj jedinicu
            </Button>
            <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => setBulkDialogOpen(true)}>
              <Archive className="mr-2 h-4 w-4" /> Bulk radnje
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-white/70 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === units.length}
                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                    aria-label="Označi sve podprostore"
                  />
                  Jedinica
                </div>
              </th>
              <th className="px-4 py-3 font-semibold">Kat</th>
              <th className="px-4 py-3 font-semibold">Površina</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Zakupnik</th>
              <th className="px-4 py-3 font-semibold">Ugovor</th>
              <th className="px-4 py-3 font-semibold">Osnovna zakupnina</th>
              <th className="px-4 py-3 font-semibold">Raspoloživo od</th>
              <th className="px-4 py-3 font-semibold text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {units.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nema definiranih podprostora. Dodajte prvu jedinicu koristeći gumb iznad.
                </td>
              </tr>
            ) : (
              units.map((unit) => {
                const isSelected = selectedIds.has(unit.id);
                const tenantName = resolveUnitTenantName(unit, tenantsById);
                return (
                  <tr
                    key={unit.id}
                    className="group cursor-pointer transition hover:bg-muted/40"
                    onClick={() => openUnitDetail(unit)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            toggleUnitSelection(unit.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Označi jedinicu ${getUnitDisplayName(unit)}`}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{getUnitDisplayName(unit)}</span>
                          {unit.oznaka && unit.naziv && (
                            <span className="text-xs text-muted-foreground">{unit.oznaka}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{unit.kat || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{unit.povrsina_m2 ? `${unit.povrsina_m2} m²` : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(unit.status)}`}>
                        {formatUnitStatus(unit.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tenantName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{resolveContractLabel(unit)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{unit.osnovna_zakupnina != null ? formatCurrency(unit.osnovna_zakupnina) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{unit.raspolozivo_od ? formatDate(unit.raspolozivo_od) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            openUnitDetail(unit);
                          }}
                          aria-label="Pregled jedinice"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditForm(unit);
                          }}
                          aria-label="Uredi jedinicu"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteUnit(unit);
                          }}
                          aria-label="Obriši jedinicu"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={unitFormOpen} onOpenChange={(open) => {
        setUnitFormOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{unitFormMode === 'create' ? 'Dodaj podprostor' : 'Uredi podprostor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit-oznaka">Identifikator *</Label>
                <Input
                  id="unit-oznaka"
                  value={unitFormData.oznaka}
                  onChange={(event) => handleUnitFormChange('oznaka', event.target.value)}
                  placeholder="npr. A2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-naziv">Naziv</Label>
                <Input
                  id="unit-naziv"
                  value={unitFormData.naziv}
                  onChange={(event) => handleUnitFormChange('naziv', event.target.value)}
                  placeholder="npr. Ured A2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-kat">Kat / zona</Label>
                <Input
                  id="unit-kat"
                  value={unitFormData.kat}
                  onChange={(event) => handleUnitFormChange('kat', event.target.value)}
                  placeholder="npr. Kat 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-povrsina">Površina (m²)</Label>
                <Input
                  id="unit-povrsina"
                  type="number"
                  step="0.01"
                  value={unitFormData.povrsina_m2}
                  onChange={(event) => handleUnitFormChange('povrsina_m2', event.target.value)}
                  placeholder="npr. 120"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={unitFormData.status} onValueChange={(value) => handleUnitFormChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Odaberite status" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-rent">Osnovna zakupnina (€)</Label>
                <Input
                  id="unit-rent"
                  type="number"
                  step="0.01"
                  value={unitFormData.osnovna_zakupnina}
                  onChange={(event) => handleUnitFormChange('osnovna_zakupnina', event.target.value)}
                  placeholder="npr. 1500"
                />
              </div>
              <div className="space-y-2">
                <Label>Zakupnik</Label>
                <Select
                  value={unitFormData.zakupnik_id || 'none'}
                  onValueChange={(value) => handleUnitFormChange('zakupnik_id', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dodijeli zakupnika" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez zakupnika</SelectItem>
                    {tenantOptions.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.naziv_firme || tenant.ime_prezime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ugovor</Label>
                <Select
                  value={unitFormData.ugovor_id || 'none'}
                  onValueChange={(value) => handleUnitFormChange('ugovor_id', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Poveži ugovor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez ugovora</SelectItem>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.interna_oznaka} ({formatDate(contract.datum_pocetka)} - {formatDate(contract.datum_zavrsetka)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit-available">Raspoloživo od</Label>
                <Input
                  id="unit-available"
                  type="date"
                  value={unitFormData.raspolozivo_od}
                  onChange={(event) => handleUnitFormChange('raspolozivo_od', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-layout">Pozicija / tlocrt</Label>
                <Input
                  id="unit-layout"
                  value={unitFormData.layout_ref}
                  onChange={(event) => handleUnitFormChange('layout_ref', event.target.value)}
                  placeholder="npr. Grid A3 ili URL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-notes">Napomena</Label>
              <Textarea
                id="unit-notes"
                value={unitFormData.napomena}
                onChange={(event) => handleUnitFormChange('napomena', event.target.value)}
                placeholder="Interna napomena, posebne upute i sl."
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setUnitFormOpen(false)} disabled={unitSubmitting}>
              Odustani
            </Button>
            <Button onClick={submitUnitForm} disabled={unitSubmitting}>
              {unitSubmitting ? 'Spremanje...' : 'Spremi' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk ažuriranje podprostora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Odabrano je {selectedIds.size} jedinica. Odaberite promjene koje želite primijeniti na sve.
            </p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={bulkForm.status || 'none'} onValueChange={(value) => setBulkForm((prev) => ({ ...prev, status: value === 'none' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Bez promjene" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez promjene</SelectItem>
                  {unitStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-rent">Nova osnovna zakupnina (€)</Label>
              <Input
                id="bulk-rent"
                type="number"
                step="0.01"
                value={bulkForm.osnovna_zakupnina}
                onChange={(event) => setBulkForm((prev) => ({ ...prev, osnovna_zakupnina: event.target.value }))}
                placeholder="Ostavi prazno za bez promjene"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkSubmitting}>
              Odustani
            </Button>
            <Button onClick={applyBulkUpdates} disabled={bulkSubmitting}>
              {bulkSubmitting ? 'Primjena...' : 'Primijeni promjene'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unitDetailOpen} onOpenChange={(open) => {
        if (!open) {
          closeUnitDetail();
        } else {
          setUnitDetailOpen(true);
        }
      }}>
        <DialogContent className="max-w-3xl">
          {resolvedUnitDetail ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{getUnitDisplayName(resolvedUnitDetail)}</span>
                  <Badge className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(resolvedUnitDetail.status)}`}>
                    {formatUnitStatus(resolvedUnitDetail.status)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoField label="Identifikator" value={resolvedUnitDetail.oznaka || '—'} />
                <InfoField label="Kat / zona" value={resolvedUnitDetail.kat || '—'} />
                <InfoField label="Površina" value={resolvedUnitDetail.povrsina_m2 ? `${resolvedUnitDetail.povrsina_m2} m²` : '—'} />
                <InfoField label="Osnovna zakupnina" value={resolvedUnitDetail.osnovna_zakupnina != null ? formatCurrency(resolvedUnitDetail.osnovna_zakupnina) : '—'} />
                <InfoField label="Zakupnik" value={resolveUnitTenantName(resolvedUnitDetail, tenantsById)} />
                <InfoField label="Ugovor" value={resolveContractLabel(resolvedUnitDetail)} />
                <InfoField label="Raspoloživo od" value={resolvedUnitDetail.raspolozivo_od ? formatDate(resolvedUnitDetail.raspolozivo_od) : '—'} />
                <InfoField label="Pripada nekretnini" value={property?.naziv || '—'} />
              </div>

              {resolvedUnitDetail.napomena && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Napomena</p>
                  <p>{resolvedUnitDetail.napomena}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Dokumenti</h4>
                  <Button size="sm" variant="outline" onClick={() => openEditForm(resolvedUnitDetail)}>
                    <Edit className="mr-2 h-4 w-4" /> Uredi jedinicu
                  </Button>
                </div>
                {unitDocsLoading ? (
                  <p className="text-sm text-muted-foreground">Učitavanje dokumenata...</p>
                ) : unitDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nema dokumenata povezanih s ovim podprostorom.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {unitDocuments.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-white/80 px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{doc.naziv}</span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {doc.tip} • {formatDate(doc.kreiran)}
                          </span>
                        </div>
                        {doc.putanja_datoteke && (
                          <Button asChild variant="outline" size="sm">
                            <a href={buildDocumentUrl(doc)} target="_blank" rel="noreferrer">
                              Preuzmi
                            </a>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">Jedinica nije pronađena.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Nekretnine Component
const Nekretnine = () => {
  const [nekretnine, setNekretnine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNekretnina, setEditingNekretnina] = useState(null);
  const [selectedNekretnina, setSelectedNekretnina] = useState(null);

  const [propertySearch, setPropertySearch] = useState('');
  const propertyTypeOptions = useMemo(() => {
    const types = new Set((nekretnine || []).map((item) => item.vrsta).filter(Boolean));
    return Array.from(types);
  }, [nekretnine]);
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { dokumenti, ugovori, zakupnici, propertyUnitsByProperty, refresh: refreshEntities } = useEntityStore();
  const navigate = useNavigate();

  const documentsByProperty = useMemo(() => {
    return dokumenti.reduce((acc, dokument) => {
      if (dokument.nekretnina_id) {
        if (!acc[dokument.nekretnina_id]) {
          acc[dokument.nekretnina_id] = [];
        }
        acc[dokument.nekretnina_id].push(dokument);
      }
      return acc;
    }, {});
  }, [dokumenti]);

  const contractsByProperty = useMemo(() => {
    return ugovori.reduce((acc, ugovor) => {
      if (!acc[ugovor.nekretnina_id]) {
        acc[ugovor.nekretnina_id] = [];
      }
      acc[ugovor.nekretnina_id].push(ugovor);
      return acc;
    }, {});
  }, [ugovori]);

  const tenantsById = useMemo(() => {
    return Object.fromEntries(zakupnici.map((zakupnik) => [zakupnik.id, zakupnik]));
  }, [zakupnici]);

  const unitsSummaryByProperty = useMemo(() => {
    const summaries = {};
    Object.entries(propertyUnitsByProperty || {}).forEach(([propertyId, unitsForProperty]) => {
      summaries[propertyId] = computeUnitsSummary(unitsForProperty || []);
    });
    return summaries;
  }, [propertyUnitsByProperty]);

  const renderPropertyNotes = useCallback((notes) => {
    if (!notes || !notes.trim()) {
      return <p className="text-sm text-muted-foreground/80">Nema zabilježenih napomena.</p>;
    }
    const lines = notes.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return (
      <ul className="space-y-2 text-sm text-muted-foreground/90">
        {lines.map((line, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary/70" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }, []);

  const handleAddValuation = useCallback((property) => {
    if (!property) {
      return;
    }
    sessionStorage.setItem('dokumentPrefill', JSON.stringify({
      naziv: `Procjena vrijednosti - ${property.naziv}` ,
      tip: 'procjena_vrijednosti',
      opis: property.adresa || '',
      nekretnina_id: property.id,
    }));
    navigate(`/dokumenti?tip=procjena_vrijednosti&nekretnina=${property.id}`);
  }, [navigate]);

  const handleViewValuations = useCallback((propertyId) => {
    navigate(`/dokumenti?tip=procjena_vrijednosti&nekretnina=${propertyId}`);
  }, [navigate]);

  useEffect(() => {
    fetchNekretnine();
  }, []);

  const fetchNekretnine = async () => {
    try {
      const response = await api.getNekretnine();
      setNekretnine(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju nekretnina:', error);
      toast.error('Greška pri učitavanju nekretnina');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNekretnina = async (formPayload) => {
    const { property, units } = normaliseNekretninaPayload(formPayload);
    try {
      const response = await api.createNekretnina(property);
      const createdProperty = response.data;

      if (units && units.length) {
        for (const unitPayload of units) {
          if (!unitPayload.oznaka) {
            continue;
          }
          try {
            await api.createUnit(createdProperty.id, unitPayload);
          } catch (error) {
            console.error('Neuspjelo kreiranje podprostora:', error);
            toast.error(`Podprostor ${unitPayload.oznaka} nije kreiran. Pokušajte ga dodati kasnije.`);
          }
        }
      }

      toast.success('Nekretnina je uspješno kreirana');
      await fetchNekretnine();
      await refreshEntities();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju nekretnine:', error);
      toast.error('Greška pri kreiranju nekretnine');
    }
  };

  const handleUpdateNekretnina = async (formPayload) => {
    const { property, units } = normaliseNekretninaPayload(formPayload);
    try {
      await api.updateNekretnina(editingNekretnina.id, property);

      if (units && units.length) {
        const existing = propertyUnitsByProperty?.[editingNekretnina.id] || [];
        const existingByOznaka = new Map(
          existing
            .filter((unit) => unit?.oznaka)
            .map((unit) => [unit.oznaka.trim().toLowerCase(), unit])
        );

        const duplicates = [];

        for (const unitPayload of units) {
          if (!unitPayload.oznaka) {
            continue;
          }
          const key = unitPayload.oznaka.trim().toLowerCase();
          if (existingByOznaka.has(key)) {
            duplicates.push(unitPayload.oznaka);
            continue;
          }
          try {
            await api.createUnit(editingNekretnina.id, unitPayload);
          } catch (error) {
            console.error('Neuspjelo kreiranje podprostora:', error);
            toast.error(`Podprostor ${unitPayload.oznaka} nije kreiran. Pokušajte ga dodati kasnije.`);
          }
        }

        if (duplicates.length) {
          toast.warning(`Podprostor${duplicates.length > 1 ? 'i' : ''} ${duplicates.join(', ')} već postoji i nije ponovno kreiran.`);
        }
      }

      toast.success('Nekretnina je uspješno ažurirana');
      await fetchNekretnine();
      await refreshEntities();
      setEditingNekretnina(null);
    } catch (error) {
      console.error('Greška pri ažuriranju nekretnine:', error);
      toast.error('Greška pri ažuriranju nekretnine');
    }
  };

  const handleDeleteNekretnina = async (nekretnina_id) => {
    if (window.confirm('Jeste li sigurni da želite obrisati ovu nekretninu?')) {
      try {
        await api.deleteNekretnina(nekretnina_id);
        toast.success('Nekretnina je uspješno obrisana');
        fetchNekretnine();
        await refreshEntities();
      } catch (error) {
        console.error('Greška pri brisanju nekretnine:', error);
        toast.error('Greška pri brisanju nekretnine');
      }
    }
  };

  const handleDownloadDokument = (dokument) => {
    if (!dokument.putanja_datoteke) {
      toast.error('PDF nije dostupan za ovaj dokument');
      return;
    }
    const url = `${BACKEND_URL}/${dokument.putanja_datoteke}`;
    window.open(url, '_blank', 'noopener');
  };

  const generatePropertyReport = async (nekretnina) => {
    try {
      toast.info('Generiranje PDF analize...');

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ANALIZA NEKRETNINE', 105, 20, { align: 'center' });

      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('OSNOVNI PODACI', 20, 40);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Naziv: ${nekretnina.naziv}`, 20, 50);
      doc.text(`Adresa: ${nekretnina.adresa}`, 20, 58);
      doc.text(`Katastarska općina: ${nekretnina.katastarska_opcina}`, 20, 66);
      doc.text(`Broj kat. čestice: ${nekretnina.broj_kat_cestice}`, 20, 74);
      doc.text(`Vrsta: ${formatPropertyType(nekretnina.vrsta)}`, 20, 82);
      doc.text(`Površina: ${formatArea(nekretnina.povrsina)}`, 20, 90);
      if (nekretnina.godina_izgradnje) {
        doc.text(`Godina izgradnje: ${nekretnina.godina_izgradnje}`, 20, 98);
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('VLASNIŠTVO', 20, 115);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vlasnik: ${nekretnina.vlasnik || 'N/A'}`, 20, 125);
      doc.text(`Udio vlasništva: ${nekretnina.udio_vlasnistva || 'N/A'}`, 20, 133);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIJSKA ANALIZA', 20, 150);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      let yPos = 160;

      const nabavna = parseNumericValue(nekretnina.nabavna_cijena);
      const trzisna = parseNumericValue(nekretnina.trzisna_vrijednost);
      const prihodi = parseNumericValue(nekretnina.prosllogodisnji_prihodi);
      const rashodi = parseNumericValue(nekretnina.prosllogodisnji_rashodi);
      const amortizacija = parseNumericValue(nekretnina.amortizacija);
      const neto = parseNumericValue(nekretnina.proslogodisnji_neto_prihod);
      const troskovi = parseNumericValue(nekretnina.troskovi_odrzavanja);

      if (nabavna !== null) {
        doc.text(`Nabavna cijena: ${formatCurrency(nabavna)}`, 20, yPos);
        yPos += 8;
      }
      if (trzisna !== null) {
        doc.text(`Tržišna vrijednost: ${formatCurrency(trzisna)}`, 20, yPos);
        yPos += 8;
        if (nabavna !== null) {
          const difference = trzisna - nabavna;
          const percentage = nabavna !== 0 ? ((difference / nabavna) * 100).toFixed(2) : '0.00';
          doc.text(`Promjena vrijednosti: ${formatCurrency(difference)} (${percentage}%)`, 20, yPos);
          yPos += 8;
        }
      }
      if (prihodi !== null) {
        doc.text(`Prihodi prošle godine: ${formatCurrency(prihodi)}`, 20, yPos);
        yPos += 8;
      }
      if (rashodi !== null) {
        doc.text(`Rashodi prošle godine: ${formatCurrency(rashodi)}`, 20, yPos);
        yPos += 8;
      }
      if (amortizacija !== null) {
        doc.text(`Amortizacija: ${formatCurrency(amortizacija)}`, 20, yPos);
        yPos += 8;
      }
      if (neto !== null) {
        doc.text(`Neto prihod: ${formatCurrency(neto)}`, 20, yPos);
        yPos += 8;
      }
      if (troskovi !== null) {
        doc.text(`Trošak održavanja: ${formatCurrency(troskovi)}`, 20, yPos);
        yPos += 8;
      }
      if (nekretnina.osiguranje) {
        doc.text(`Osiguranje: ${nekretnina.osiguranje}`, 20, yPos);
        yPos += 8;
      }

      if (nekretnina.zadnja_obnova || nekretnina.potrebna_ulaganja) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('ODRŽAVANJE', 20, yPos + 10);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        yPos += 22;

        if (nekretnina.zadnja_obnova) {
          doc.text(`Zadnja obnova: ${nekretnina.zadnja_obnova}`, 20, yPos);
          yPos += 8;
        }
        if (nekretnina.potrebna_ulaganja) {
          const ulaganja = doc.splitTextToSize(`Potrebna ulaganja: ${nekretnina.potrebna_ulaganja}`, 170);
          doc.text(ulaganja, 20, yPos);
          yPos += ulaganja.length * 6 + 4;
        }
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RIZICI', 20, yPos + 10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPos += 22;

      if (nekretnina.sudski_sporovi) {
        const sporovi = doc.splitTextToSize(`Sudski sporovi: ${nekretnina.sudski_sporovi}`, 170);
        doc.text(sporovi, 20, yPos);
        yPos += sporovi.length * 6 + 4;
      }
      if (nekretnina.hipoteke) {
        const hipoteke = doc.splitTextToSize(`Hipoteka: ${nekretnina.hipoteke}`, 170);
        doc.text(hipoteke, 20, yPos);
        yPos += hipoteke.length * 6 + 4;
      }
      if (nekretnina.napomene) {
        const napomene = doc.splitTextToSize(`Napomene upravitelja: ${nekretnina.napomene}`, 170);
        doc.text(napomene, 20, yPos);
        yPos += napomene.length * 6 + 4;
      }

      const fileName = `Nekretnina_${nekretnina.naziv.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast.success(`PDF analiza za ${nekretnina.naziv} je uspješno generirana`);
    } catch (error) {
      console.error('Greška pri generiranju PDF analize:', error);
      toast.error('Greška pri generiranju PDF analize');
    }
  };

  const renderContractStatusBadge = (status) => {
    const statusMap = {
      aktivno: { label: 'Aktivno', variant: 'default' },
      na_isteku: { label: 'Na isteku', variant: 'secondary' },
      raskinuto: { label: 'Raskinuto', variant: 'destructive' },
      arhivirano: { label: 'Arhivirano', variant: 'outline' },
    };
    const info = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const computeRoi = (nekretnina) => {
    const neto = parseNumericValue(nekretnina.proslogodisnji_neto_prihod);
    const osnova = parseNumericValue(nekretnina.nabavna_cijena) || parseNumericValue(nekretnina.trzisna_vrijednost);
    if (neto === null || osnova === null || osnova === 0) {
      return null;
    }
    return (neto / osnova) * 100;
  };

  const filteredProperties = useMemo(() => {
    const search = propertySearch.trim().toLowerCase();

    return nekretnine.filter((property) => {
      if (search) {
        const haystack = `${property.naziv || ''} ${property.adresa || ''}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (typeFilter !== 'all' && property.vrsta !== typeFilter) {
        return false;
      }

      const riskCount = getRiskBadges(property).length;
      if (riskFilter === 'risk' && riskCount === 0) {
        return false;
      }
      if (riskFilter === 'clear' && riskCount > 0) {
        return false;
      }

      return true;
    });
  }, [nekretnine, propertySearch, typeFilter, riskFilter]);

  const { totalArea, averageOccupancy, totalValue, totalGrossIncome, totalOperatingExpense, totalNetIncome, averageRoi } = useMemo(() => {
    if (!filteredProperties.length) {
      return { totalArea: 0, averageOccupancy: null, totalValue: 0, totalGrossIncome: 0, totalOperatingExpense: 0, totalNetIncome: 0, averageRoi: null };
    }

    let areaSum = 0;
    let valueSum = 0;
    let occupancySum = 0;
    let occupancyCount = 0;
    let grossSum = 0;
    let expenseSum = 0;
    let netSum = 0;
    let roiSum = 0;
    let roiCount = 0;

    filteredProperties.forEach((property) => {
      const area = parseNumericValue(property.povrsina) || 0;
      areaSum += area;
      valueSum += parseNumericValue(property.trzisna_vrijednost) || 0;

      const grossIncome = parseNumericValue(property.prosllogodisnji_prihodi) || 0;
      const operatingExpense = parseNumericValue(property.prosllogodisnji_rashodi) || 0;
      const netIncome = parseNumericValue(property.proslogodisnji_neto_prihod);
      grossSum += grossIncome;
      expenseSum += operatingExpense;
      if (netIncome !== null) {
        netSum += netIncome;
      } else {
        netSum += grossIncome - operatingExpense;
      }

      const contracts = contractsByProperty[property.id] || [];
      if (contracts.length) {
        const active = contracts.filter((c) => c.status === 'aktivno').length;
        occupancySum += (active / contracts.length) * 100;
        occupancyCount += 1;
      }

      const propertyRoi = computeRoi(property);
      if (propertyRoi !== null) {
        roiSum += propertyRoi;
        roiCount += 1;
      }
    });

    return {
      totalArea: areaSum,
      totalValue: valueSum,
      averageOccupancy: occupancyCount ? occupancySum / occupancyCount : null,
      totalGrossIncome: grossSum,
      totalOperatingExpense: expenseSum,
      totalNetIncome: netSum,
      averageRoi: roiCount ? roiSum / roiCount : null,
    };
  }, [filteredProperties, contractsByProperty]);

  const selectedFinancials = useMemo(() => {
    if (!selectedNekretnina) {
      return null;
    }

    const grossIncome = parseNumericValue(selectedNekretnina.prosllogodisnji_prihodi) || 0;
    const operatingExpense = parseNumericValue(selectedNekretnina.prosllogodisnji_rashodi) || 0;
    const netIncomeRaw = parseNumericValue(selectedNekretnina.proslogodisnji_neto_prihod);
    const netIncome = netIncomeRaw !== null ? netIncomeRaw : grossIncome - operatingExpense;
    const maintenanceCost = parseNumericValue(selectedNekretnina.troskovi_odrzavanja) || 0;
    const amortization = parseNumericValue(selectedNekretnina.amortizacija) || 0;
    const investmentBase = parseNumericValue(selectedNekretnina.nabavna_cijena) || parseNumericValue(selectedNekretnina.trzisna_vrijednost) || null;
    const roiValue = computeRoi(selectedNekretnina);
    const margin = grossIncome ? (netIncome / Math.abs(grossIncome)) * 100 : null;
    const paybackYears = netIncome > 0 && investmentBase ? investmentBase / netIncome : null;

    return {
      grossIncome,
      operatingExpense,
      netIncome,
      maintenanceCost,
      amortization,
      investmentBase,
      roiValue,
      margin,
      paybackYears,
    };
  }, [selectedNekretnina]);

  if (loading) {
    return <div className="px-6 py-10">Učitava nekretnine...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Portfelj nekretnina</h1>
          <p className="text-sm text-muted-foreground">
            Pregledajte status, ugovore i ulaganja za svaku imovinu te aktivirajte AI analitiku kada treba reakcija.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="dodaj-nekretninu-btn"
          className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2">Dodaj nekretninu</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ukupna površina</p>
              <p className="text-2xl font-semibold text-foreground">{formatArea(totalArea)}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">Portfolio</Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prosječna popunjenost</p>
              <p className="text-2xl font-semibold text-foreground">{averageOccupancy !== null ? formatPercentage(averageOccupancy) : '—'}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">Leasing</Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procijenjena vrijednost</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalValue)}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">Valuacija</Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Neto prihod (12M)</p>
              <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalNetIncome)}</p>
              <p className="text-xs text-muted-foreground">Prosječni ROI: {averageRoi !== null ? formatPercentage(averageRoi) : '—'}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">Profit</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex w-full items-center gap-2 md:max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            placeholder="Pretraži naziv ili adresu..."
            className="flex-1"
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rizik</span>
            <div className="flex gap-2">
              <Button
                variant={riskFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRiskFilter('all')}
              >
                Sve
              </Button>
              <Button
                variant={riskFilter === 'risk' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRiskFilter('risk')}
              >
                Sa rizikom
              </Button>
              <Button
                variant={riskFilter === 'clear' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRiskFilter('clear')}
              >
                Bez rizika
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vrsta</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] text-left">
                <SelectValue placeholder="Sve vrste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve vrste</SelectItem>
                {propertyTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>{formatPropertyType(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {filteredProperties.map((nekretnina) => {
          const propertyDocuments = documentsByProperty[nekretnina.id] || [];
          const propertyContracts = contractsByProperty[nekretnina.id] || [];
          const activeContracts = propertyContracts.filter((ugovor) => ugovor.status === 'aktivno');
          const expiringContracts = propertyContracts.filter((ugovor) => ugovor.status === 'na_isteku');
          const occupancy = propertyContracts.length ? (activeContracts.length / propertyContracts.length) * 100 : null;
          const propertyUnitsForCard = propertyUnitsByProperty[nekretnina.id] || [];
          const unitsSummary = unitsSummaryByProperty[nekretnina.id];
          const hasUnits = Boolean(unitsSummary && unitsSummary.total);
          const unitOccupancyValue = hasUnits ? unitsSummary.occupancy : null;
          const unitOccupancyLabel = hasUnits ? formatPercentage(unitsSummary.occupancy) : '—';
          const unitLeasedLabel = hasUnits ? `${unitsSummary.leased}/${unitsSummary.total}` : null;
          const unitAvailableCount = hasUnits ? unitsSummary.available : null;
          const unitReservedCount = hasUnits ? unitsSummary.reserved : null;
          const unitStatusBreakdown = hasUnits
            ? [
                { status: 'iznajmljeno', count: unitsSummary.leased },
                { status: 'rezervirano', count: unitsSummary.reserved },
                { status: 'dostupno', count: unitsSummary.available },
              ]
            : [];
          const roi = computeRoi(nekretnina);
          const riskBadges = getRiskBadges(nekretnina);
          const activeSummary = propertyContracts.length ? `${activeContracts.length}/${propertyContracts.length}` : '0';
          const grossIncome = parseNumericValue(nekretnina.prosllogodisnji_prihodi) || 0;
          const operatingExpense = parseNumericValue(nekretnina.prosllogodisnji_rashodi) || 0;
          const netIncomeRaw = parseNumericValue(nekretnina.proslogodisnji_neto_prihod);
          const resolvedNetIncome = netIncomeRaw !== null ? netIncomeRaw : grossIncome - operatingExpense;
          const margin = grossIncome ? (resolvedNetIncome / Math.abs(grossIncome)) * 100 : null;
          const investmentBase = parseNumericValue(nekretnina.nabavna_cijena) || parseNumericValue(nekretnina.trzisna_vrijednost) || null;
          const paybackYears = resolvedNetIncome > 0 && investmentBase ? investmentBase / resolvedNetIncome : null;

          return (
            <Card key={nekretnina.id} data-testid={`nekretnina-card-${nekretnina.id}`} className="card-hover border border-border/60 shadow-shell">
              <CardHeader className="border-b border-border/60 bg-primary/5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-semibold text-foreground">{nekretnina.naziv}</CardTitle>
                      <Badge variant="outline" className="rounded-full border-primary/30 bg-white/70 text-[11px] uppercase tracking-[0.18em] text-primary">
                        {formatPropertyType(nekretnina.vrsta)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{nekretnina.adresa}</p>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">KO {nekretnina.katastarska_opcina} • Čestica {nekretnina.broj_kat_cestice}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {hasUnits && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <span>Jedinice</span>
                          <span className="font-semibold text-foreground">{unitLeasedLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, unitOccupancyValue || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">{unitOccupancyLabel}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {unitStatusBreakdown.map((item) => (
                            <Badge
                              key={item.status}
                              variant="outline"
                              className={`rounded-full text-[10px] ${getUnitStatusBadgeClass(item.status)}`}
                            >
                              {formatUnitStatus(item.status)}: {item.count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {riskBadges.map((badge) => (
                        <Badge key={badge.label} variant={badge.variant} className="rounded-full uppercase text-[11px]">
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <InfoField label="Površina" value={formatArea(nekretnina.povrsina)} />
                  <InfoField label="Godina izgradnje" value={nekretnina.godina_izgradnje || '—'} />
                  <InfoField label="Vlasnik" value={nekretnina.vlasnik || '—'} />
                  <InfoField label="Udio vlasništva" value={nekretnina.udio_vlasnistva || '—'} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 xl:grid-cols-4">
                  <InfoField
                    label="Jedinice (iznajmljeno / ukupno)"
                    value={hasUnits ? unitLeasedLabel : '—'}
                  />
                  <InfoField
                    label="Popunjenost (jedinice)"
                    value={hasUnits ? unitOccupancyLabel : '—'}
                  />
                  <InfoField
                    label="Dostupni podprostori"
                    value={hasUnits ? unitAvailableCount : '—'}
                  />
                  <InfoField
                    label="Rezervirano"
                    value={hasUnits ? unitReservedCount : '—'}
                  />
                  <InfoField label="Aktivni ugovori" value={activeSummary} />
                  <InfoField label="Popunjenost (ugovori)" value={occupancy !== null ? formatPercentage(occupancy) : '—'} />
                  <InfoField label="Ugovori na isteku" value={expiringContracts.length || '0'} />
                  <InfoField label="Dokumenti" value={propertyDocuments.length || '0'} />
                  <InfoField label="Tržišna vrijednost" value={formatCurrency(nekretnina.trzisna_vrijednost)} />
                  <InfoField label="ROI (neto / investicija)" value={roi !== null ? formatPercentage(roi) : '—'} />
                  <InfoField label="Period povrata" value={paybackYears ? `${paybackYears.toFixed(1)} god.` : '—'} />
                  <InfoField label="Zadnja obnova" value={formatDate(nekretnina.zadnja_obnova)} />
                </div>

                {(grossIncome || operatingExpense || resolvedNetIncome) && (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-white/60 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financijski presjek (posljednjih 12 mjeseci)</p>
                      {margin !== null && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${margin >= 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600'}`}
                        >
                          Marža: {formatDeltaPercentage(margin)}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Prihodi</p>
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(grossIncome)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Operativni troškovi</p>
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(operatingExpense)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Neto rezultat</p>
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(resolvedNetIncome)}</p>
                      </div>
                    </div>
                    {grossIncome > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Struktura troškova</span>
                          <span>{formatCurrency(operatingExpense)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80"
                            style={{ width: `${Math.min(100, Math.max(0, (operatingExpense / grossIncome) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {paybackYears && (
                      <p className="text-xs text-muted-foreground">Procijenjeni period povrata investicije: {paybackYears.toFixed(1)} godina</p>
                    )}
                  </div>
                )}

                {nekretnina.potrebna_ulaganja && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                    <p className="text-xs uppercase text-amber-600 font-semibold">Planirana ulaganja</p>
                    <p className="text-sm text-amber-800">{nekretnina.potrebna_ulaganja}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-border/40 bg-primary/5">
                <div className="text-xs text-muted-foreground/80">
                  Posljednje ažuriranje: {formatDate(nekretnina.updated_at || nekretnina.kreiran || nekretnina.azuriran)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedNekretnina(nekretnina)}
                    data-testid={`pregled-nekretnine-${nekretnina.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Pregled
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingNekretnina(nekretnina)}
                    data-testid={`uredi-nekretninu-${nekretnina.id}`}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Uredi
                  </Button>
                  <Button 
                    size="icon"
                    variant="outline"
                    onClick={() => handleDeleteNekretnina(nekretnina.id)}
                    data-testid={`obrisi-nekretninu-${nekretnina.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="default" 
                    size="icon"
                    onClick={() => generatePropertyReport(nekretnina)}
                    data-testid={`pdf-analiza-${nekretnina.id}`}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedNekretnina} onOpenChange={(open) => {
        if (!open) {
          setSelectedNekretnina(null);
        }
      }}>
        {selectedNekretnina && (
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="nekretnina-details-description">
            <DialogHeader>
              <DialogTitle className="flex flex-col gap-1">
                <span className="text-2xl font-semibold text-foreground">{selectedNekretnina.naziv}</span>
                <span className="text-sm font-normal text-muted-foreground">{selectedNekretnina.adresa}</span>
              </DialogTitle>
            </DialogHeader>
            <div id="nekretnina-details-description" className="sr-only">
              Detaljan pregled podataka o nekretnini, financija, dokumentacije i rizika
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
                <TabsTrigger value="overview">Pregled</TabsTrigger>
                <TabsTrigger value="units">Podprostori</TabsTrigger>
                <TabsTrigger value="financije">Financije</TabsTrigger>
                <TabsTrigger value="dokumenti">Dokumenti</TabsTrigger>
                <TabsTrigger value="ugovori">Ugovori &amp; zakupnici</TabsTrigger>
                <TabsTrigger value="odrzavanje">Održavanje</TabsTrigger>
                <TabsTrigger value="rizici">Rizici</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Osnovne informacije</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Naziv" value={selectedNekretnina.naziv} />
                      <InfoField label="Lokacija" value={selectedNekretnina.adresa} />
                      <InfoField label="Vrsta" value={formatPropertyType(selectedNekretnina.vrsta)} />
                      <InfoField label="Površina" value={formatArea(selectedNekretnina.povrsina)} />
                      <InfoField label="Godina izgradnje" value={selectedNekretnina.godina_izgradnje || '—'} />
                      <InfoField label="Katastarska općina" value={selectedNekretnina.katastarska_opcina || '—'} />
                      <InfoField label="Čestica" value={selectedNekretnina.broj_kat_cestice || '—'} />
                      <InfoField label="Osiguranje" value={selectedNekretnina.osiguranje || '—'} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dokumentacija</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Zemljišnoknjižni izvadak" value={formatBooleanish(selectedNekretnina.zemljisnoknjizni_izvadak)} />
                      <InfoField label="Uporabna dozvola" value={formatBooleanish(selectedNekretnina.uporabna_dozvola)} />
                      <InfoField label="Građevinska dozvola" value={formatBooleanish(selectedNekretnina.gradevinska_dozvola)} />
                      <InfoField label="Energetski certifikat" value={formatBooleanish(selectedNekretnina.energetski_certifikat)} />
                      <InfoField label="Ostala dokumentacija" value={selectedNekretnina.ostala_dokumentacija || '—'} />
                    </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Napomene i brojila</CardTitle>
                <p className="text-xs text-muted-foreground/80">
                  Detalji za terenska očitanja, pristupne kodove, serijske brojeve brojila i sve ostale operativne napomene.
                </p>
              </CardHeader>
              <CardContent>
                {renderPropertyNotes(selectedNekretnina.napomene)}
              </CardContent>
            </Card>

              </TabsContent>

          <TabsContent value="units" className="space-y-4">
                <PropertyUnitsPanel
                  property={selectedNekretnina}
                  units={sortUnitsByPosition(propertyUnitsByProperty[selectedNekretnina.id] || [])}
                  tenants={zakupnici}
                  tenantsById={tenantsById}
                  contracts={contractsByProperty[selectedNekretnina.id] || []}
                  onRefresh={refreshEntities}
                />
              </TabsContent>

              <TabsContent value="financije" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Financijski pregled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InfoField label="Tržišna vrijednost" value={formatCurrency(selectedNekretnina.trzisna_vrijednost)} />
                      <InfoField label="Nabavna cijena" value={formatCurrency(selectedNekretnina.nabavna_cijena)} />
                      <InfoField label="Prihodi (12M)" value={formatCurrency(selectedNekretnina.prosllogodisnji_prihodi)} />
                      <InfoField label="Troškovi (12M)" value={formatCurrency(selectedNekretnina.prosllogodisnji_rashodi)} />
                      <InfoField label="Amortizacija" value={formatCurrency(selectedNekretnina.amortizacija)} />
                      <InfoField label="Neto prihod (12M)" value={formatCurrency(selectedNekretnina.proslogodisnji_neto_prihod)} />
                      <InfoField label="Trošak održavanja" value={formatCurrency(selectedNekretnina.troskovi_odrzavanja)} />
                      <InfoField label="ROI" value={(() => {
                        const roiValue = computeRoi(selectedNekretnina);
                        return roiValue !== null ? formatPercentage(roiValue) : '—';
                      })()} />
                      <InfoField label="Period povrata" value={selectedFinancials?.paybackYears ? `${selectedFinancials.paybackYears.toFixed(1)} god.` : '—'} />
                    </div>

                    {selectedFinancials && (
                      <div className="mt-6 space-y-4 rounded-xl border border-border/60 bg-white/60 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Struktura rezultata</p>
                          {selectedFinancials.margin !== null && (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${selectedFinancials.margin >= 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600'}`}>
                              Marža: {formatDeltaPercentage(selectedFinancials.margin)}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prihodi</p>
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedFinancials.grossIncome)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Operativni troškovi</p>
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedFinancials.operatingExpense)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Neto rezultat</p>
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedFinancials.netIncome)}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Održavanje</p>
                            <p className="text-base font-medium text-foreground">{formatCurrency(selectedFinancials.maintenanceCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amortizacija</p>
                            <p className="text-base font-medium text-foreground">{formatCurrency(selectedFinancials.amortization)}</p>
                          </div>
                        </div>
                        {selectedFinancials.grossIncome > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Udio troškova u prihodima</span>
                              <span>{formatDeltaPercentage((selectedFinancials.operatingExpense / selectedFinancials.grossIncome) * 100)}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/80"
                                style={{ width: `${Math.min(100, Math.max(0, (selectedFinancials.operatingExpense / selectedFinancials.grossIncome) * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dokumenti" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Povezani dokumenti</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(documentsByProperty[selectedNekretnina.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground/80">Nema povezanih dokumenata. Dodajte ih iz modula Dokumenti.</p>
                    ) : (
                      <div className="space-y-2">
                        {(documentsByProperty[selectedNekretnina.id] || []).map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium text-foreground">{doc.naziv}</p>
                              <p className="text-xs text-muted-foreground/80">
                                {formatDocumentType(doc.tip)} • {formatDate(doc.kreiran)}
                              </p>
                            </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadDokument(doc)}>
                    <Download className="w-4 h-4 mr-1" />
                    Otvori
                  </Button>
                </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ugovori" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Aktivni ugovori i zakupnici</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(contractsByProperty[selectedNekretnina.id] || []).length === 0 ? (
                      <div className="space-y-3 text-sm text-muted-foreground/80">
                        <p>Još nema ugovora povezanih s ovom nekretninom.</p>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedNekretnina(null);
                          navigate('/ugovori');
                        }}>
                          Kreiraj ugovor
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(contractsByProperty[selectedNekretnina.id] || []).map((ugovor) => {
                          const zakupnik = tenantsById[ugovor.zakupnik_id];
                          return (
                            <div key={ugovor.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{ugovor.interna_oznaka}</p>
                                <p className="text-xs text-muted-foreground/80">
                                  {formatDate(ugovor.datum_pocetka)} — {formatDate(ugovor.datum_zavrsetka)}
                                </p>
                                <p className="text-xs text-muted-foreground/80">
                                  Zakupnik: {zakupnik?.naziv_firme || zakupnik?.ime_prezime || 'Nepoznat zakupnik'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderContractStatusBadge(ugovor.status)}
                                <Button variant="outline" size="sm" onClick={() => navigate(`/ugovori?highlight=${ugovor.id}`)}>
                                  Detalji
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="odrzavanje" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Plan i status održavanja</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Zadnja obnova" value={formatDate(selectedNekretnina.zadnja_obnova)} />
                      <InfoField label="Planirana ulaganja" value={selectedNekretnina.potrebna_ulaganja || '—'} />
                      <InfoField label="Trošak održavanja" value={formatCurrency(selectedNekretnina.troskovi_odrzavanja)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rizici" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Rizici i tereti</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Sudski sporovi" value={selectedNekretnina.sudski_sporovi || '—'} />
                      <InfoField label="Hipoteke" value={selectedNekretnina.hipoteke || '—'} />
                    </div>
                    <div className="border border-border/60 rounded-md p-3 bg-primary/5 text-sm text-muted-foreground">
                      <p>Napomena upravitelja:</p>
                      <p className="mt-1 text-foreground">{selectedNekretnina.napomene || 'Nema dodatnih napomena.'}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="nekretnina-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novu nekretninu</DialogTitle>
          </DialogHeader>
          <div id="nekretnina-form-description" className="sr-only">
            Forma za kreiranje nove nekretnine s osnovnim informacijama
          </div>
          <NekretninarForm 
            onSubmit={handleCreateNekretnina}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNekretnina} onOpenChange={() => setEditingNekretnina(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="uredi-nekretninu-form-description">
          <DialogHeader>
            <DialogTitle>Uredi nekretninu</DialogTitle>
          </DialogHeader>
          <div id="uredi-nekretninu-form-description" className="sr-only">
            Forma za uređivanje postojeće nekretnine
          </div>
          <NekretninarForm 
            nekretnina={editingNekretnina}
            existingUnits={editingNekretnina ? propertyUnitsByProperty?.[editingNekretnina.id] || [] : []}
            onSubmit={handleUpdateNekretnina}
            onCancel={() => setEditingNekretnina(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Nekretnina Form Component
const NekretninarForm = ({ nekretnina, onSubmit, onCancel, existingUnits = [] }) => {
  const [formData, setFormData] = useState({
    naziv: nekretnina?.naziv || '',
    adresa: nekretnina?.adresa || '',
    katastarska_opcina: nekretnina?.katastarska_opcina || '',
    broj_kat_cestice: nekretnina?.broj_kat_cestice || '',
    vrsta: nekretnina?.vrsta || 'stan',
    povrsina: nekretnina?.povrsina || '',
    godina_izgradnje: nekretnina?.godina_izgradnje || '',
    vlasnik: nekretnina?.vlasnik || '',
    udio_vlasnistva: nekretnina?.udio_vlasnistva || '',
    nabavna_cijena: nekretnina?.nabavna_cijena || '',
    trzisna_vrijednost: nekretnina?.trzisna_vrijednost || '',
    prosllogodisnji_prihodi: nekretnina?.prosllogodisnji_prihodi || '',
    prosllogodisnji_rashodi: nekretnina?.prosllogodisnji_rashodi || '',
    amortizacija: nekretnina?.amortizacija || '',
    proslogodisnji_neto_prihod: nekretnina?.proslogodisnji_neto_prihod || '',
    zadnja_obnova: nekretnina?.zadnja_obnova || '',
    potrebna_ulaganja: nekretnina?.potrebna_ulaganja || '',
    troskovi_odrzavanja: nekretnina?.troskovi_odrzavanja || '',
    osiguranje: nekretnina?.osiguranje || '',
    sudski_sporovi: nekretnina?.sudski_sporovi || '',
    hipoteke: nekretnina?.hipoteke || '',
    napomene: nekretnina?.napomene || ''
  });
  const [unitsDraft, setUnitsDraft] = useState([]);
  const isEditing = Boolean(nekretnina);
  const unitStatusOptions = useMemo(
    () => Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => ({ value, label: config.label })),
    []
  );
  const existingUnitsList = useMemo(() => sortUnitsByPosition(existingUnits || []), [existingUnits]);

  const createDraftUnit = () => ({
    localId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `unit-${Date.now()}-${Math.random()}`,
    oznaka: '',
    naziv: '',
    kat: '',
    povrsina_m2: '',
    status: 'dostupno',
    osnovna_zakupnina: '',
    napomena: '',
  });

  const handleAddUnitDraft = () => {
    setUnitsDraft((prev) => [...prev, createDraftUnit()]);
  };

  const handleRemoveUnitDraft = (unitId) => {
    setUnitsDraft((prev) => prev.filter((unit) => unit.localId !== unitId));
  };

  const handleUpdateUnitDraft = (unitId, field, value) => {
    setUnitsDraft((prev) => prev.map((unit) => (unit.localId === unitId ? { ...unit, [field]: value } : unit)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      povrsina: parseFloat(formData.povrsina) || 0,
      godina_izgradnje: formData.godina_izgradnje ? parseInt(formData.godina_izgradnje) : null,
      nabavna_cijena: formData.nabavna_cijena ? parseFloat(formData.nabavna_cijena) : null,
      trzisna_vrijednost: formData.trzisna_vrijednost ? parseFloat(formData.trzisna_vrijednost) : null,
      prosllogodisnji_prihodi: formData.prosllogodisnji_prihodi ? parseFloat(formData.prosllogodisnji_prihodi) : null,
      prosllogodisnji_rashodi: formData.prosllogodisnji_rashodi ? parseFloat(formData.prosllogodisnji_rashodi) : null,
      amortizacija: formData.amortizacija ? parseFloat(formData.amortizacija) : null,
      proslogodisnji_neto_prihod: formData.proslogodisnji_neto_prihod ? parseFloat(formData.proslogodisnji_neto_prihod) : null,
      troskovi_odrzavanja: formData.troskovi_odrzavanja ? parseFloat(formData.troskovi_odrzavanja) : null,
      zadnja_obnova: formData.zadnja_obnova || null
    };
    const preparedUnits = unitsDraft
      .filter((unit) => (unit.oznaka && unit.oznaka.trim()) || (unit.naziv && unit.naziv.trim()))
      .map((unit) => ({
        oznaka: unit.oznaka.trim(),
        naziv: unit.naziv?.trim() || null,
        kat: unit.kat?.trim() || null,
        povrsina_m2: unit.povrsina_m2 ? parseNumericValue(unit.povrsina_m2) : null,
        status: unit.status || 'dostupno',
        osnovna_zakupnina: unit.osnovna_zakupnina ? parseNumericValue(unit.osnovna_zakupnina) : null,
        napomena: unit.napomena?.trim() || null,
      }));

    onSubmit({ nekretnina: data, units: preparedUnits });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="nekretnina-form">
      <Tabs defaultValue="osnovni" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
          <TabsTrigger value="financije">Financije</TabsTrigger>
          <TabsTrigger value="odrzavanje">Održavanje</TabsTrigger>
          <TabsTrigger value="rizici">Rizici</TabsTrigger>
          <TabsTrigger value="units">Podprostori</TabsTrigger>
        </TabsList>
        
        <TabsContent value="osnovni" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="naziv">Naziv nekretnine *</Label>
              <Input
                id="naziv"
                value={formData.naziv}
                onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
                data-testid="nekretnina-naziv-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="vrsta">Vrsta nekretnine *</Label>
              <Select value={formData.vrsta} onValueChange={(value) => setFormData({ ...formData, vrsta: value })}>
                <SelectTrigger data-testid="nekretnina-vrsta-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poslovna_zgrada">Poslovna zgrada</SelectItem>
                  <SelectItem value="stan">Stan</SelectItem>
                  <SelectItem value="zemljiste">Zemljište</SelectItem>
                  <SelectItem value="ostalo">Ostalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="adresa">Adresa *</Label>
            <Input
              id="adresa"
              value={formData.adresa}
              onChange={(e) => setFormData({ ...formData, adresa: e.target.value })}
              data-testid="nekretnina-adresa-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="katastarska_opcina">Katastarska općina *</Label>
              <Input
                id="katastarska_opcina"
                value={formData.katastarska_opcina}
                onChange={(e) => setFormData({ ...formData, katastarska_opcina: e.target.value })}
                data-testid="nekretnina-ko-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="broj_kat_cestice">Broj kat. čestice *</Label>
              <Input
                id="broj_kat_cestice"
                value={formData.broj_kat_cestice}
                onChange={(e) => setFormData({ ...formData, broj_kat_cestice: e.target.value })}
                data-testid="nekretnina-cestica-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="povrsina">Površina (m²) *</Label>
              <Input
                id="povrsina"
                type="number"
                step="0.01"
                value={formData.povrsina}
                onChange={(e) => setFormData({ ...formData, povrsina: e.target.value })}
                data-testid="nekretnina-povrsina-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="godina_izgradnje">Godina izgradnje</Label>
              <Input
                id="godina_izgradnje"
                type="number"
                value={formData.godina_izgradnje}
                onChange={(e) => setFormData({ ...formData, godina_izgradnje: e.target.value })}
                data-testid="nekretnina-godina-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vlasnik">Vlasnik *</Label>
              <Input
                id="vlasnik"
                value={formData.vlasnik}
                onChange={(e) => setFormData({ ...formData, vlasnik: e.target.value })}
                data-testid="nekretnina-vlasnik-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="udio_vlasnistva">Udio vlasništva *</Label>
              <Input
                id="udio_vlasnistva"
                value={formData.udio_vlasnistva}
                onChange={(e) => setFormData({ ...formData, udio_vlasnistva: e.target.value })}
                data-testid="nekretnina-udio-input"
                placeholder="npr. 1/1, 50%, itd."
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financije" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nabavna_cijena">Nabavna cijena (€)</Label>
              <Input
                id="nabavna_cijena"
                type="number"
                step="0.01"
                value={formData.nabavna_cijena}
                onChange={(e) => setFormData({ ...formData, nabavna_cijena: e.target.value })}
                data-testid="nekretnina-nabavna-input"
              />
            </div>
            <div>
              <Label htmlFor="trzisna_vrijednost">Tržišna vrijednost (€)</Label>
              <Input
                id="trzisna_vrijednost"
                type="number"
                step="0.01"
                value={formData.trzisna_vrijednost}
                onChange={(e) => setFormData({ ...formData, trzisna_vrijednost: e.target.value })}
                data-testid="nekretnina-trzisna-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prosllogodisnji_prihodi">Prošlogodišnji prihodi (€)</Label>
              <Input
                id="prosllogodisnji_prihodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_prihodi}
                onChange={(e) => setFormData({ ...formData, prosllogodisnji_prihodi: e.target.value })}
                data-testid="nekretnina-prihodi-input"
              />
            </div>
            <div>
              <Label htmlFor="prosllogodisnji_rashodi">Prošlogodišnji rashodi (€)</Label>
              <Input
                id="prosllogodisnji_rashodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_rashodi}
                onChange={(e) => setFormData({ ...formData, prosllogodisnji_rashodi: e.target.value })}
                data-testid="nekretnina-rashodi-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amortizacija">Amortizacija (€)</Label>
              <Input
                id="amortizacija"
                type="number"
                step="0.01"
                value={formData.amortizacija}
                onChange={(e) => setFormData({ ...formData, amortizacija: e.target.value })}
                data-testid="nekretnina-amortizacija-input"
              />
            </div>
            <div>
              <Label htmlFor="proslogodisnji_neto_prihod">Prošlogodišnji neto prihod (€)</Label>
              <Input
                id="proslogodisnji_neto_prihod"
                type="number"
                step="0.01"
                value={formData.proslogodisnji_neto_prihod}
                onChange={(e) => setFormData({ ...formData, proslogodisnji_neto_prihod: e.target.value })}
                data-testid="nekretnina-neto-input"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="odrzavanje" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zadnja_obnova">Zadnja obnova</Label>
              <Input
                id="zadnja_obnova"
                type="date"
                value={formData.zadnja_obnova}
                onChange={(e) => setFormData({ ...formData, zadnja_obnova: e.target.value })}
                data-testid="nekretnina-obnova-input"
              />
            </div>
            <div>
              <Label htmlFor="troskovi_odrzavanja">Troškovi održavanja (€)</Label>
              <Input
                id="troskovi_odrzavanja"
                type="number"
                step="0.01"
                value={formData.troskovi_odrzavanja}
                onChange={(e) => setFormData({ ...formData, troskovi_odrzavanja: e.target.value })}
                data-testid="nekretnina-troskovi-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="potrebna_ulaganja">Potrebna ulaganja</Label>
            <Textarea
              id="potrebna_ulaganja"
              value={formData.potrebna_ulaganja}
              onChange={(e) => setFormData({ ...formData, potrebna_ulaganja: e.target.value })}
              data-testid="nekretnina-ulaganja-input"
            />
          </div>

          <div>
            <Label htmlFor="osiguranje">Osiguranje</Label>
            <Input
              id="osiguranje"
              value={formData.osiguranje}
              onChange={(e) => setFormData({ ...formData, osiguranje: e.target.value })}
              data-testid="nekretnina-osiguranje-input"
            />
          </div>

          <div>
            <Label htmlFor="napomene">Napomene i brojila</Label>
            <Textarea
              id="napomene"
              value={formData.napomene}
              onChange={(e) => setFormData({ ...formData, napomene: e.target.value })}
              data-testid="nekretnina-napomene-input"
              rows={4}
              placeholder="Primjer: Struja – brojilo 12345; Voda – brojilo A44; Glavni ventil u ormaru L3; PIN za alarm 4321"
            />
            <p className="text-xs text-muted-foreground/80">Sačuvajte operativne napomene poput lokacija brojila, kodova, specifičnih procedura ili kontakata za održavanje.</p>
          </div>
        </TabsContent>

        <TabsContent value="rizici" className="space-y-4">
          <div>
            <Label htmlFor="sudski_sporovi">Sudski sporovi</Label>
            <Textarea
              id="sudski_sporovi"
              value={formData.sudski_sporovi}
              onChange={(e) => setFormData({ ...formData, sudski_sporovi: e.target.value })}
              data-testid="nekretnina-sporovi-input"
            />
          </div>

          <div>
            <Label htmlFor="hipoteke">Hipoteke</Label>
            <Textarea
              id="hipoteke"
              value={formData.hipoteke}
              onChange={(e) => setFormData({ ...formData, hipoteke: e.target.value })}
              data-testid="nekretnina-hipoteke-input"
            />
          </div>

          <div>
            <Label htmlFor="napomene">Napomene</Label>
            <Textarea
              id="napomene"
              value={formData.napomene}
              onChange={(e) => setFormData({ ...formData, napomene: e.target.value })}
              data-testid="nekretnina-napomene-input"
            />
          </div>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Plan podprostora</h4>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? 'Dodajte nove podprostore koje želite kreirati odmah. Postojeće jedinice ostaju nepromijenjene dok ih ne uredite u kartici detalja.'
                  : 'Dodajte podprostore koje želite kreirati odmah. Ovaj korak je opcionalan – jedinice se mogu dodati i kasnije u detalju nekretnine.'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddUnitDraft}>
              <Plus className="w-4 h-4 mr-2" /> Dodaj podprostor
            </Button>
          </div>

          {isEditing && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Postojeći podprostori</p>
                <Badge variant="outline">{existingUnitsList.length}</Badge>
              </div>
              {existingUnitsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Trenutno nema podprostora kreiranih za ovu nekretninu.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {existingUnitsList.map((unit) => (
                    <div key={unit.id} className="rounded-lg border border-border/50 bg-white/80 p-3">
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>{getUnitDisplayName(unit)}</span>
                        <Badge className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(unit.status)}`}>
                          {formatUnitStatus(unit.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {unit.oznaka && <span className="rounded-full bg-muted px-2 py-1">{unit.oznaka}</span>}
                        {unit.kat && <span className="rounded-full bg-muted px-2 py-1">{unit.kat}</span>}
                        {unit.povrsina_m2 != null && <span className="rounded-full bg-muted px-2 py-1">{`${unit.povrsina_m2} m²`}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Za uređivanje postojećih podprostora otvorite detalj nekretnine i koristite karticu "Podprostori".
              </p>
            </div>
          )}

          {unitsDraft.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              {isEditing
                ? 'Dodajte podprostor pomoću gumba iznad. Novi podprostori bit će kreirani nakon spremanja promjena.'
                : 'Još niste dodali nijednu jedinicu. Nakon spremanja nekretnine podprostori se mogu uređivati u zasebnoj kartici.'}
            </div>
          ) : (
            <div className="space-y-3">
              {unitsDraft.map((unit, index) => (
                <div key={unit.localId} className="space-y-3 rounded-xl border border-border/60 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Novi podprostor {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUnitDraft(unit.localId)}
                      aria-label="Ukloni podprostor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Oznaka *</Label>
                      <Input
                        value={unit.oznaka}
                        onChange={(e) => handleUpdateUnitDraft(unit.localId, 'oznaka', e.target.value)}
                        placeholder="npr. A2"
                        required
                      />
                    </div>
                    <div>
                      <Label>Naziv</Label>
                      <Input
                        value={unit.naziv}
                        onChange={(e) => handleUpdateUnitDraft(unit.localId, 'naziv', e.target.value)}
                        placeholder="npr. Ured A2"
                      />
                    </div>
                    <div>
                      <Label>Kat / zona</Label>
                      <Input
                        value={unit.kat}
                        onChange={(e) => handleUpdateUnitDraft(unit.localId, 'kat', e.target.value)}
                        placeholder="npr. Kat 3"
                      />
                    </div>
                    <div>
                      <Label>Površina (m²)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={unit.povrsina_m2}
                        onChange={(e) => handleUpdateUnitDraft(unit.localId, 'povrsina_m2', e.target.value)}
                        placeholder="npr. 120"
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={unit.status}
                        onValueChange={(value) => handleUpdateUnitDraft(unit.localId, 'status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite status" />
                        </SelectTrigger>
                        <SelectContent>
                          {unitStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Osnovna zakupnina (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={unit.osnovna_zakupnina}
                        onChange={(e) => handleUpdateUnitDraft(unit.localId, 'osnovna_zakupnina', e.target.value)}
                        placeholder="npr. 1500"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Napomena</Label>
                    <Textarea
                      value={unit.napomena}
                      onChange={(e) => handleUpdateUnitDraft(unit.localId, 'napomena', e.target.value)}
                      placeholder="npr. open space ured, pogled na park"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-nekretninu-form">
          {nekretnina ? 'Ažuriraj' : 'Kreiraj'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-nekretninu-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Zakupnici Component
const Zakupnici = () => {
  const { zakupnici, loading: storeLoading, error: storeError, refresh: refreshEntities } = useEntityStore();
  const [searchValue, setSearchValue] = useState('');
  const [tenantView, setTenantView] = useState('active');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingZakupnik, setEditingZakupnik] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const activeCount = useMemo(
    () => zakupnici.filter((tenant) => (tenant.status || 'aktivan') !== 'arhiviran').length,
    [zakupnici]
  );
  const archivedCount = useMemo(
    () => zakupnici.filter((tenant) => (tenant.status || 'aktivan') === 'arhiviran').length,
    [zakupnici]
  );

  const filteredZakupnici = useMemo(() => {
    const base = zakupnici.filter((tenant) => {
      const status = tenant.status || 'aktivan';
      return tenantView === 'archived' ? status === 'arhiviran' : status !== 'arhiviran';
    });

    const trimmed = searchValue.trim();
    if (!trimmed) {
      return base;
    }

    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const pick = (value) => (value || '').toString().toLowerCase();

    return base.filter((tenant) => {
      const haystack = [
        tenant.naziv_firme,
        tenant.ime_prezime,
        tenant.oib,
        tenant.sjediste,
        tenant.kontakt_ime,
        tenant.kontakt_email,
        tenant.kontakt_telefon,
        tenant.iban,
      ].map(pick);

      return tokens.every((token) => haystack.some((field) => field.includes(token)));
    });
  }, [zakupnici, searchValue, tenantView]);

  const handleCreateZakupnik = async (formData) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.createZakupnik({ ...formData, status: formData.status || 'aktivan' });
      toast.success('Zakupnik je uspješno kreiran');
      await refreshEntities();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju zakupnika:', error);
      toast.error('Greška pri kreiranju zakupnika');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZakupnik = async (formData) => {
    if (!editingZakupnik || submitting) return;
    setSubmitting(true);
    try {
      await api.updateZakupnik(editingZakupnik.id, { ...formData, status: formData.status || 'aktivan' });
      toast.success('Zakupnik je uspješno ažuriran');
      await refreshEntities();
      setEditingZakupnik(null);
    } catch (error) {
      console.error('Greška pri ažuriranju zakupnika:', error);
      toast.error('Greška pri ažuriranju zakupnika');
    } finally {
      setSubmitting(false);
    }
  };

  const buildZakupnikPayload = (tenant, overrides = {}) => ({
    naziv_firme: tenant.naziv_firme || '',
    ime_prezime: tenant.ime_prezime || '',
    oib: tenant.oib || '',
    sjediste: tenant.sjediste || '',
    kontakt_ime: tenant.kontakt_ime || '',
    kontakt_email: tenant.kontakt_email || '',
    kontakt_telefon: tenant.kontakt_telefon || '',
    iban: tenant.iban || '',
    status: overrides.status || tenant.status || 'aktivan',
  });

  const handleToggleArchive = async (tenant, nextStatus) => {
    try {
      await api.updateZakupnik(tenant.id, buildZakupnikPayload(tenant, { status: nextStatus }));
      toast.success(nextStatus === 'arhiviran' ? 'Zakupnik je arhiviran' : 'Zakupnik je ponovno aktivan');
      await refreshEntities();
    } catch (error) {
      console.error('Greška pri promjeni statusa zakupnika:', error);
      toast.error('Promjena statusa zakupnika nije uspjela');
    }
  };

  if (storeLoading) {
    return <div className="px-6 py-10">Učitava zakupnike...</div>;
  }

  if (storeError) {
    return (
      <div className="px-6 py-10 text-sm text-destructive">
        Greška pri učitavanju zakupnika. Pokušajte ponovno kasnije.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Zakupnici</h1>
          <p className="text-sm text-muted-foreground">
            Evidencija partnera s ključnim kontaktima, financijskim podacima i AI podsjetnicima za obnovu ugovora.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pretraži po nazivu, OIB-u ili kontaktu..."
              className="pl-10"
              aria-label="Pretraži zakupnike"
              data-testid="zakupnici-search-input"
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={tenantView === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTenantView('active')}
              >
                Aktivni ({activeCount})
              </Button>
              <Button
                variant={tenantView === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTenantView('archived')}
                disabled={archivedCount === 0}
              >
                Arhivirani ({archivedCount})
              </Button>
            </div>
            <Button
              onClick={() => setShowCreateForm(true)}
              data-testid="dodaj-zakupnika-btn"
              className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span className="ml-2">Dodaj zakupnika</span>
            </Button>
          </div>
        </div>
      </div>

      {filteredZakupnici.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{tenantView === 'archived' ? 'Nema arhiviranih zakupnika' : 'Nema rezultata'}</p>
            <p className="text-sm text-muted-foreground">
              {tenantView === 'archived' ? 'Zakupnici koje arhivirate prikazat će se ovdje.' : 'Pokušajte s drugim upitom ili dodajte novog zakupnika.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredZakupnici.map((zakupnik) => {
            const displayName = zakupnik.naziv_firme || zakupnik.ime_prezime || 'Nepoznati zakupnik';
            const entityType = zakupnik.naziv_firme ? 'Tvrtka' : 'Osoba';
            const isArchived = (zakupnik.status || 'aktivan') === 'arhiviran';

            return (
              <Card key={zakupnik.id} data-testid={`zakupnik-card-${zakupnik.id}`} className="card-hover shadow-shell">
                <CardHeader className="border-b border-border/40 bg-primary/5 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <CardTitle className="text-lg font-semibold text-foreground">{displayName}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide">
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-white/70 text-primary">{entityType}</Badge>
                        {isArchived && (
                          <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
                            Arhiviran
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-6 text-sm text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-foreground">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Phone className="h-4 w-4 text-primary/70" />
                        {zakupnik.kontakt_telefon || 'Telefon nije zabilježen'}
                      </span>
                      {zakupnik.kontakt_email && (
                        <a
                          href={`mailto:${zakupnik.kontakt_email}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          <Mail className="h-3 w-3" />
                          {zakupnik.kontakt_email}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground/80">
                      <MapPin className="h-4 w-4 text-primary/60" />
                      <span>{zakupnik.sjediste || 'Adresa nije navedena'}</span>
                    </div>
                    {zakupnik.kontakt_ime && (
                      <p className="text-muted-foreground/80">Kontakt osoba: <span className="font-medium text-foreground">{zakupnik.kontakt_ime}</span></p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="bg-white">OIB: {zakupnik.oib || '—'}</Badge>
                    {zakupnik.iban && (
                      <Badge variant="outline" className="bg-white">IBAN: {zakupnik.iban}</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-muted-foreground/70">
                      <Badge variant="outline" className="rounded-full border-primary/30 bg-white/70 text-primary">{entityType}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingZakupnik(zakupnik)}
                        data-testid={`uredi-zakupnika-${zakupnik.id}`}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="ml-2">Uredi</span>
                      </Button>
                      <Button
                        variant={isArchived ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleToggleArchive(zakupnik, isArchived ? 'aktivan' : 'arhiviran')}
                      >
                        {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        <span className="ml-2">{isArchived ? 'Vrati' : 'Arhiviraj'}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl" aria-describedby="dodaj-zakupnika-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novog zakupnika</DialogTitle>
          </DialogHeader>
          <div id="dodaj-zakupnika-form-description" className="sr-only">
            Forma za kreiranje novog zakupnika
          </div>
          <ZakupnikForm
            onSubmit={handleCreateZakupnik}
            onCancel={() => setShowCreateForm(false)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingZakupnik)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingZakupnik(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl" aria-describedby="uredi-zakupnik-form-description">
          <DialogHeader>
            <DialogTitle>Uredi zakupnika</DialogTitle>
          </DialogHeader>
          <div id="uredi-zakupnik-form-description" className="sr-only">
            Forma za ažuriranje postojećeg zakupnika
          </div>
          <ZakupnikForm
            zakupnik={editingZakupnik}
            onSubmit={handleUpdateZakupnik}
            onCancel={() => setEditingZakupnik(null)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Zakupnik Form Component
const ZakupnikForm = ({ zakupnik, onSubmit, onCancel, submitting = false }) => {
  const [formData, setFormData] = useState({
    naziv_firme: zakupnik?.naziv_firme || '',
    ime_prezime: zakupnik?.ime_prezime || '',
    oib: zakupnik?.oib || '',
    sjediste: zakupnik?.sjediste || '',
    kontakt_ime: zakupnik?.kontakt_ime || '',
    kontakt_email: zakupnik?.kontakt_email || '',
    kontakt_telefon: zakupnik?.kontakt_telefon || '',
    iban: zakupnik?.iban || '',
    status: zakupnik?.status || 'aktivan'
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const data = {
      ...formData,
      naziv_firme: formData.naziv_firme || null,
      ime_prezime: formData.ime_prezime || null,
      iban: formData.iban || null,
      status: formData.status || 'aktivan'
    };
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="zakupnik-form">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="naziv_firme">Naziv firme</Label>
          <Input
            id="naziv_firme"
            value={formData.naziv_firme}
            onChange={(e) => setFormData({ ...formData, naziv_firme: e.target.value })}
            data-testid="zakupnik-naziv-input"
          />
        </div>
        <div>
          <Label htmlFor="ime_prezime">Ime i prezime</Label>
          <Input
            id="ime_prezime"
            value={formData.ime_prezime}
            onChange={(e) => setFormData({ ...formData, ime_prezime: e.target.value })}
            data-testid="zakupnik-ime-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
        <Label htmlFor="oib">OIB / VAT ID *</Label>
        <Input
          id="oib"
          value={formData.oib}
          onChange={(e) => setFormData({ ...formData, oib: e.target.value })}
          data-testid="zakupnik-oib-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
            data-testid="zakupnik-iban-input"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="sjediste">Sjedište / adresa *</Label>
        <Input
          id="sjediste"
          value={formData.sjediste}
          onChange={(e) => setFormData({ ...formData, sjediste: e.target.value })}
          data-testid="zakupnik-sjediste-input"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="kontakt_ime">Kontakt osoba *</Label>
          <Input
            id="kontakt_ime"
            value={formData.kontakt_ime}
            onChange={(e) => setFormData({ ...formData, kontakt_ime: e.target.value })}
            data-testid="zakupnik-kontakt-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="kontakt_email">Email *</Label>
          <Input
            id="kontakt_email"
            type="email"
            value={formData.kontakt_email}
            onChange={(e) => setFormData({ ...formData, kontakt_email: e.target.value })}
            data-testid="zakupnik-email-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="kontakt_telefon">Telefon *</Label>
          <Input
            id="kontakt_telefon"
            value={formData.kontakt_telefon}
            onChange={(e) => setFormData({ ...formData, kontakt_telefon: e.target.value })}
            data-testid="zakupnik-telefon-input"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger data-testid="zakupnik-status-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aktivan">Aktivan</SelectItem>
            <SelectItem value="arhiviran">Arhiviran</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex space-x-2">
        <Button
          type="submit"
          data-testid="potvrdi-zakupnik-form"
          disabled={submitting}
        >
          {submitting ? 'Spremam...' : zakupnik ? 'Spremi promjene' : 'Kreiraj zakupnika'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-zakupnik-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Ugovori Component
const Ugovori = () => {
  const { ugovori, nekretnine, zakupnici, dokumenti, propertyUnitsByProperty, propertyUnitsById, loading: storeLoading, error: storeError, refresh: refreshEntities } = useEntityStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('aktivno');
  const [renewalTemplate, setRenewalTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const [isMutating, setIsMutating] = useState(false);
  const documentsByContract = useMemo(() => {
    return dokumenti.reduce((acc, dokument) => {
      if (dokument.ugovor_id) {
        if (!acc[dokument.ugovor_id]) {
          acc[dokument.ugovor_id] = [];
        }
        acc[dokument.ugovor_id].push(dokument);
      }
      return acc;
    }, {});
  }, [dokumenti]);

  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [editingContract, setEditingContract] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('action') === 'renew') {
      const template = sessionStorage.getItem('renewalTemplate');
      if (template) {
        setRenewalTemplate(JSON.parse(template));
        setShowCreateForm(true);
        sessionStorage.removeItem('renewalTemplate');
      }
    }
  }, [location]);

  const nekretnineById = useMemo(() => Object.fromEntries(nekretnine.map((item) => [item.id, item])), [nekretnine]);
  const zakupniciById = useMemo(() => Object.fromEntries(zakupnici.map((item) => [item.id, item])), [zakupnici]);

  const handleSubmitUgovor = async (formData) => {
    if (isMutating) {
      return;
    }
    setIsMutating(true);
    try {
      if (editingContract) {
        await api.updateUgovor(editingContract.id, formData);
        toast.success('Ugovor je uspješno ažuriran');
      } else {
        await api.createUgovor(formData);
        toast.success('Ugovor je uspješno kreiran');
      }
      await refreshEntities();
      setShowCreateForm(false);
      setRenewalTemplate(null);
      setEditingContract(null);
    } catch (error) {
      console.error('Greška pri spremanju ugovora:', error);
      toast.error('Spremanje ugovora nije uspjelo');
    } finally {
      setIsMutating(false);
    }
  };

  const handleStatusChange = async (ugovorId, noviStatus) => {
    try {
      await api.updateStatusUgovora(ugovorId, noviStatus);
      toast.success('Status ugovora je ažuriran');
      await refreshEntities();
    } catch (error) {
      console.error('Greška pri ažuriranju statusa:', error);
      toast.error('Greška pri ažuriranju statusa');
    }
  };

  const getNekretnina = useCallback((nekretninaId) => nekretnineById[nekretninaId], [nekretnineById]);

  const getZakupnik = useCallback((zakupnikId) => zakupniciById[zakupnikId], [zakupniciById]);

  const getDocumentUrl = useCallback((dokument) => buildDocumentUrl(dokument), []);

  const getStatusBadge = (status) => {
    const statusMap = {
      'aktivno': { label: 'Aktivno', variant: 'default' },
      'na_isteku': { label: 'Na isteku', variant: 'secondary' },
      'raskinuto': { label: 'Raskinuto', variant: 'destructive' },
      'arhivirano': { label: 'Arhivirano', variant: 'outline' }
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const isUgovorNaIsteku = (ugovor) => {
    const danas = new Date();
    const datumZavrsetka = new Date(ugovor.datum_zavrsetka);
    const daniDo = Math.ceil((datumZavrsetka - danas) / (1000 * 60 * 60 * 24));
    return daniDo <= 90 && daniDo > 0; // Ugovori koji ističu u sljedećih 90 dana
  };

  const handleDownloadContractDocument = (dokument) => {
    const url = getDocumentUrl(dokument);
    if (!url) {
      toast.error('PDF nije dostupan za ovaj dokument');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const handlePreviewContractDocument = (dokument) => {
    setPreviewDocument(dokument);
    setShowPreviewDialog(true);
  };

  const archivedStatuses = ARCHIVED_CONTRACT_STATUSES;
  const activeContractsCount = useMemo(() => ugovori.filter((u) => u.status === 'aktivno').length, [ugovori]);
  const archivedContractsCount = useMemo(() => ugovori.filter((u) => archivedStatuses.has(u.status)).length, [ugovori]);
  const expiringContractsCount = useMemo(() => ugovori.filter((u) => u.status === 'aktivno' && isUgovorNaIsteku(u)).length, [ugovori]);
  const loading = storeLoading && ugovori.length === 0;
  const refreshingStore = storeLoading && ugovori.length > 0;

  const filteredUgovori = ugovori.filter(ugovor => {
    // Prvo filtriraj po statusu
    let matches = true;
    if (filterStatus !== 'svi') {
      if (filterStatus === 'na_isteku') {
        matches = ugovor.status === 'aktivno' && isUgovorNaIsteku(ugovor);
      } else if (filterStatus === 'arhivirano') {
        matches = archivedStatuses.has(ugovor.status);
      } else {
        matches = ugovor.status === filterStatus;
      }
    }
    
    // Zatim filtriraj po pretraživanju
    if (matches && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nekretnina = getNekretnina(ugovor.nekretnina_id);
      const zakupnik = getZakupnik(ugovor.zakupnik_id);
      
      matches = ugovor.interna_oznaka.toLowerCase().includes(query) ||
               nekretnina?.naziv.toLowerCase().includes(query) ||
               nekretnina?.adresa.toLowerCase().includes(query) ||
               zakupnik?.naziv_firme?.toLowerCase().includes(query) ||
               zakupnik?.ime_prezime?.toLowerCase().includes(query) ||
               zakupnik?.oib.includes(query);
    }
    
    return matches;
  });

  if (loading) {
    return <div className="p-8">Učitava ugovore...</div>;
  }

  if (storeError && !ugovori.length) {
    return <div className="px-6 py-10 text-sm text-destructive">Greška pri učitavanju ugovora. Pokušajte ponovno kasnije.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {refreshingStore && (
        <div className="text-xs text-muted-foreground/70">Osvježavanje podataka...</div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Ugovori o zakupu</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Pretraži ugovore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
              data-testid="search-contracts-input"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <Button 
            onClick={() => {
              setEditingContract(null);
              setRenewalTemplate(null);
              setShowCreateForm(true);
            }}
            data-testid="dodaj-ugovor-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj ugovor
          </Button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex space-x-2">
        <Button 
          variant={filterStatus === 'svi' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('svi')}
          size="sm"
        >
          Svi ({ugovori.length})
        </Button>
        <Button 
          variant={filterStatus === 'aktivno' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('aktivno')}
          size="sm"
        >
          Aktivni ({activeContractsCount})
        </Button>
        <Button 
          variant={filterStatus === 'na_isteku' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('na_isteku')}
          size="sm"
          className="bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          <Bell className="w-4 h-4 mr-1" />
          Na isteku ({expiringContractsCount})
        </Button>
        <Button 
          variant={filterStatus === 'arhivirano' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('arhivirano')}
          size="sm"
        >
          Arhivirani ({archivedContractsCount})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredUgovori.map((ugovor) => {
          const nekretnina = getNekretnina(ugovor.nekretnina_id);
          const zakupnik = getZakupnik(ugovor.zakupnik_id);
          const naIsteku = isUgovorNaIsteku(ugovor);
          const contractDocuments = documentsByContract[ugovor.id] || [];
          const propertyUnit = ugovor.property_unit_id ? propertyUnitsById?.[ugovor.property_unit_id] : null;
          const propertyUnitLabel = propertyUnit ? getUnitDisplayName(propertyUnit) : null;
          const propertyUnitStatus = propertyUnit ? formatUnitStatus(propertyUnit.status) : null;

          return (
            <Card key={ugovor.id} className={naIsteku ? 'border-orange-200 bg-orange-50' : ''} data-testid={`ugovor-card-${ugovor.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {ugovor.interna_oznaka}
                  <div className="flex space-x-2">
                    {naIsteku && <Badge variant="secondary" className="bg-orange-200 text-orange-800">⚠️ Ističe uskoro</Badge>}
                    {getStatusBadge(ugovor.status)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-blue-600">{nekretnina?.naziv}</p>
                  <p className="text-sm text-muted-foreground">{nekretnina?.adresa}</p>
                </div>
                <div>
                  <p className="font-medium">{zakupnik?.naziv_firme || zakupnik?.ime_prezime}</p>
                  <p className="text-sm text-muted-foreground">OIB: {zakupnik?.oib}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Podprostor: {propertyUnitLabel || '—'}</p>
                  {propertyUnit && (
                    <p className="text-xs text-muted-foreground">
                      {propertyUnitStatus}
                      {propertyUnit.povrsina_m2 ? ` • ${propertyUnit.povrsina_m2} m²` : ''}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Početak:</span> {new Date(ugovor.datum_pocetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Završetak:</span> {new Date(ugovor.datum_zavrsetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Trajanje:</span> {ugovor.trajanje_mjeseci} mj.
                  </div>
                  <div>
                    <span className="font-medium">Otkaz:</span> {ugovor.rok_otkaza_dani} dana
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-lg font-bold text-green-600">
                    {ugovor.osnovna_zakupnina.toLocaleString()} €/mjesec
                  </p>
                  {ugovor.zakupnina_po_m2 && (
                    <p className="text-sm text-muted-foreground">
                      {ugovor.zakupnina_po_m2.toLocaleString()} €/m²
                    </p>
                  )}
                  {ugovor.polog_depozit && (
                    <p className="text-sm text-muted-foreground">
                      Polog: {ugovor.polog_depozit.toLocaleString()} €
                    </p>
                  )}
                </div>
                {contractDocuments.length > 0 && (
                  <div className="border-t border-border/40 pt-2 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground/80 uppercase">
                      Dokumenti ({contractDocuments.length})
                    </p>
                    <ul className="space-y-1 text-sm">
                      {contractDocuments.slice(0, 3).map((dokument) => (
                        <li key={dokument.id} className="flex items-center justify-between gap-2">
                          <span className="truncate mr-2" title={dokument.naziv}>
                            {dokument.naziv}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreviewContractDocument(dokument)}
                              disabled={!dokument.putanja_datoteke}
                              className="h-8 w-8"
                              data-testid={`ugovor-doc-preview-${dokument.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadContractDocument(dokument)}
                              disabled={!dokument.putanja_datoteke}
                              data-testid={`ugovor-doc-download-${dokument.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {contractDocuments.length > 3 && (
                      <p className="text-xs text-muted-foreground/80">
                        +{contractDocuments.length - 3} dodatnih dokumenata
                      </p>
                    )}
                  </div>
                )}
                
                {/* Status change dropdown */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Select 
                    value={ugovor.status} 
                    onValueChange={(value) => handleStatusChange(ugovor.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktivno">Aktivno</SelectItem>
                      <SelectItem value="na_isteku">Na isteku</SelectItem>
                      <SelectItem value="raskinuto">Raskinuto</SelectItem>
                      <SelectItem value="arhivirano">Arhivirano</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingContract(ugovor);
                      setRenewalTemplate(null);
                      setShowCreateForm(true);
                    }}
                    data-testid={`uredi-ugovor-${ugovor.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" /> Uredi ugovor
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Contract Dialog */}
      <Dialog
        open={showCreateForm}
        onOpenChange={(open) => {
          setShowCreateForm(open);
          if (!open) {
            setEditingContract(null);
            setRenewalTemplate(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="ugovor-form-description">
          <DialogHeader>
            <DialogTitle>
              {editingContract
                ? 'Uredi ugovor'
                : renewalTemplate
                  ? 'Produžetak ugovora - Nova interna oznaka'
                  : 'Dodaj novi ugovor'}
            </DialogTitle>
          </DialogHeader>
          <div id="ugovor-form-description" className="sr-only">
            {editingContract ? 'Forma za uređivanje postojećeg ugovora o zakupu' : 'Forma za kreiranje novog ugovora o zakupu'}
          </div>
          <UgovorForm 
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            propertyUnitsByProperty={propertyUnitsByProperty}
            propertyUnitsById={propertyUnitsById}
            refreshEntities={refreshEntities}
            onSubmit={handleSubmitUgovor}
            onCancel={() => {
              setShowCreateForm(false);
              setRenewalTemplate(null);
              setEditingContract(null);
            }}
            renewalTemplate={renewalTemplate}
            contract={editingContract}
          />
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog
        open={showPreviewDialog}
        onOpenChange={(open) => {
          setShowPreviewDialog(open);
          if (!open) {
            setPreviewDocument(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="ugovor-document-preview-description">
          <DialogHeader>
            <DialogTitle>Pregled dokumenta</DialogTitle>
          </DialogHeader>
          <div id="ugovor-document-preview-description" className="sr-only">
            Pregled povezanog PDF dokumenta ugovora
          </div>
          {previewDocument && (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl border border-border/60 bg-primary/5 p-4 text-sm">
                <div>
                  <span className="font-medium text-primary">Naziv:</span> {previewDocument.naziv}
                </div>
                <div>
                  <span className="font-medium text-primary">Tip:</span> {formatDocumentType(previewDocument.tip)}
                </div>
                <div>
                  <span className="font-medium text-primary">Datum:</span> {new Date(previewDocument.kreiran).toLocaleDateString('hr-HR')}
                </div>
                {previewDocument.opis && (
                  <div>
                    <span className="font-medium text-primary">Opis:</span>
                    <p className="text-muted-foreground">{previewDocument.opis}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = getDocumentUrl(previewDocument);
                    if (!url) {
                      toast.error('PDF datoteka nije dostupna.');
                      return;
                    }
                    window.open(url, '_blank', 'noopener');
                  }}
                  disabled={!getDocumentUrl(previewDocument)}
                >
                  <Download className="w-4 h-4 mr-2" /> Otvori u novom prozoru
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const holder = document.querySelector('[data-document-preview]');
                    const iframe = holder ? holder.querySelector('iframe') : null;
                    const url = getDocumentUrl(previewDocument);
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                      return;
                    }
                    if (url) {
                      const printWindow = window.open(url, '_blank', 'noopener');
                      if (printWindow) {
                        printWindow.addEventListener('load', () => printWindow.print(), { once: true });
                      }
                    } else {
                      toast.error('PDF datoteka nije učitana za ovaj dokument');
                    }
                  }}
                  disabled={!getDocumentUrl(previewDocument)}
                >
                  <Printer className="w-4 h-4 mr-2" /> Ispiši
                </Button>
              </div>
              <DocumentViewer dokument={previewDocument} heightClass="h-[65vh]" />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

// Ugovor Form Component
const UgovorForm = ({ nekretnine, zakupnici, propertyUnitsByProperty = {}, propertyUnitsById = {}, onSubmit, onCancel, renewalTemplate, contract = null, refreshEntities = async () => {} }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [formData, setFormData] = useState({
    interna_oznaka: '',
    nekretnina_id: '',
    zakupnik_id: '',
    datum_potpisivanja: '',
    datum_pocetka: '',
    datum_zavrsetka: '',
    trajanje_mjeseci: '',
    rok_otkaza_dani: 30,
    osnovna_zakupnina: '',
    zakupnina_po_m2: '',
    cam_troskovi: '',
    polog_depozit: '',
    garancija: '',
    indeksacija: false,
    indeks: '',
    formula_indeksacije: '',
    obveze_odrzavanja: '',
    namjena_prostora: '',
    rezije_brojila: '',
    property_unit_id: '',
  });
  const [tenantOptions, setTenantOptions] = useState(zakupnici);
  const latestCreatedUnitRef = useRef(null);
  const activeTenantOptions = useMemo(
    () => tenantOptions.filter((tenant) => (tenant.status || 'aktivan') !== 'arhiviran'),
    [tenantOptions]
  );

  const tenantsById = useMemo(() => Object.fromEntries(zakupnici.map((tenant) => [tenant.id, tenant])), [zakupnici]);

  const unitsForSelectedProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return [];
    }
    return sortUnitsByPosition(propertyUnitsByProperty[formData.nekretnina_id] || []);
  }, [formData.nekretnina_id, propertyUnitsByProperty]);

  const normaliseDateInput = useCallback((value) => {
    if (!value) {
      return '';
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!contract) {
      return;
    }
    setUploadedFile(null);
    latestCreatedUnitRef.current = null;
    setFormData({
      interna_oznaka: contract.interna_oznaka || '',
      nekretnina_id: contract.nekretnina_id || '',
      zakupnik_id: contract.zakupnik_id || '',
      datum_potpisivanja: normaliseDateInput(contract.datum_potpisivanja),
      datum_pocetka: normaliseDateInput(contract.datum_pocetka),
      datum_zavrsetka: normaliseDateInput(contract.datum_zavrsetka),
      trajanje_mjeseci: contract.trajanje_mjeseci != null ? contract.trajanje_mjeseci.toString() : '',
      rok_otkaza_dani: contract.rok_otkaza_dani != null ? contract.rok_otkaza_dani.toString() : '30',
      osnovna_zakupnina: contract.osnovna_zakupnina != null ? contract.osnovna_zakupnina.toString() : '',
      zakupnina_po_m2: contract.zakupnina_po_m2 != null ? contract.zakupnina_po_m2.toString() : '',
      cam_troskovi: contract.cam_troskovi != null ? contract.cam_troskovi.toString() : '',
      polog_depozit: contract.polog_depozit != null ? contract.polog_depozit.toString() : '',
      garancija: contract.garancija != null ? contract.garancija.toString() : '',
      indeksacija: contract.indeksacija ?? false,
      indeks: contract.indeks || '',
      formula_indeksacije: contract.formula_indeksacije || '',
      obveze_odrzavanja: contract.obveze_odrzavanja || '',
      namjena_prostora: contract.namjena_prostora || '',
      rezije_brojila: contract.rezije_brojila || '',
      property_unit_id: contract.property_unit_id || '',
    });
  }, [contract, normaliseDateInput]);

  useEffect(() => {
    setTenantOptions(zakupnici);
  }, [zakupnici]);

  useEffect(() => {
    if (!formData.property_unit_id) {
      return;
    }
    const fallbackUnit =
      latestCreatedUnitRef.current && latestCreatedUnitRef.current.id === formData.property_unit_id
        ? latestCreatedUnitRef.current
        : null;
    const unit = propertyUnitsById?.[formData.property_unit_id] || fallbackUnit;
    if (!unit) {
      setFormData((prev) => ({ ...prev, property_unit_id: '' }));
      return;
    }
    if (formData.nekretnina_id && unit.nekretnina_id !== formData.nekretnina_id) {
      setFormData((prev) => ({ ...prev, property_unit_id: '' }));
    }
    if (propertyUnitsById?.[formData.property_unit_id]) {
      latestCreatedUnitRef.current = null;
    }
  }, [formData.nekretnina_id, formData.property_unit_id, propertyUnitsById]);

  useEffect(() => {
    if (!formData.property_unit_id) {
      return;
    }
    const fallbackUnit =
      latestCreatedUnitRef.current && latestCreatedUnitRef.current.id === formData.property_unit_id
        ? latestCreatedUnitRef.current
        : null;
    const unit = propertyUnitsById?.[formData.property_unit_id] || fallbackUnit;
    if (!unit) {
      return;
    }
    setFormData((prev) => {
      const updates = {};
      if (!prev.nekretnina_id && unit.nekretnina_id) {
        updates.nekretnina_id = unit.nekretnina_id;
      }
      if (!prev.zakupnik_id && unit.zakupnik_id) {
        updates.zakupnik_id = unit.zakupnik_id;
      }
      if (!prev.osnovna_zakupnina && unit.osnovna_zakupnina != null) {
        updates.osnovna_zakupnina = unit.osnovna_zakupnina.toString();
      }
      if (!prev.namjena_prostora && unit.napomena) {
        updates.namjena_prostora = unit.napomena;
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [formData.property_unit_id, propertyUnitsById]);

  const normalize = (value) => (value || '').toString().trim().toLowerCase();

  const findTenantMatch = useCallback((suggestion) => {
    if (!suggestion) {
      return null;
    }
    const targetOib = normalize(suggestion.oib);
    const targetName = normalize(suggestion.naziv_firme || suggestion.ime_prezime);
    if (!targetOib && !targetName) {
      return null;
    }
    return tenantOptions.find((tenant) => {
      const tenantOib = normalize(tenant.oib);
      const tenantName = normalize(tenant.naziv_firme || tenant.ime_prezime);
      if (targetOib && tenantOib && tenantOib === targetOib) {
        return true;
      }
      if (targetName && tenantName === targetName) {
        return true;
      }
      return false;
    }) || null;
  }, [tenantOptions]);

  const findPropertyMatch = useCallback((suggestion) => {
    if (!suggestion) {
      return null;
    }
    const targetName = normalize(suggestion.naziv);
    const targetAddress = normalize(suggestion.adresa);
    if (!targetName && !targetAddress) {
      return null;
    }
    return nekretnine.find((property) => {
      const propertyName = normalize(property.naziv);
      const propertyAddress = normalize(property.adresa);
      if (targetName && propertyName === targetName) {
        return true;
      }
      if (targetAddress && propertyAddress === targetAddress) {
        return true;
      }
      if (targetName && propertyName.includes(targetName)) {
        return true;
      }
      if (targetAddress && propertyAddress.includes(targetAddress)) {
        return true;
      }
      return false;
    }) || null;
  }, [nekretnine]);

  const findPropertyUnitMatch = useCallback((propertyId, suggestion) => {
    if (!propertyId || !suggestion) {
      return null;
    }
    const targetOznaka = normalize(suggestion.oznaka);
    const targetNaziv = normalize(suggestion.naziv);
    if (!targetOznaka && !targetNaziv) {
      return null;
    }
    const units = propertyUnitsByProperty?.[propertyId] || [];
    return (
      units.find((unit) => {
        const unitOznaka = normalize(unit.oznaka);
        const unitNaziv = normalize(unit.naziv);
        if (targetOznaka && unitOznaka === targetOznaka) {
          return true;
        }
        if (targetNaziv && unitNaziv === targetNaziv) {
          return true;
        }
        return false;
      }) || null
    );
  }, [propertyUnitsByProperty]);

  const createTenantFromSuggestion = useCallback(async (suggestion) => {
    try {
      const payload = {
        naziv_firme: suggestion.naziv_firme || null,
        ime_prezime: suggestion.ime_prezime || null,
        oib: suggestion.oib || `N/A-${Date.now()}`,
        sjediste: suggestion.sjediste || 'Nije navedeno',
        kontakt_ime: suggestion.kontakt_ime || suggestion.naziv_firme || suggestion.ime_prezime || 'Kontakt osoba',
        kontakt_email: suggestion.kontakt_email || 'kontakt@nedefinirano.hr',
        kontakt_telefon: suggestion.kontakt_telefon || '000-000-000',
        iban: suggestion.iban || '',
        status: 'aktivan',
      };
      const response = await api.createZakupnik(payload);
      const created = response.data;
      if (created?.id) {
        setTenantOptions((prev) => (prev.some((item) => item.id === created.id) ? prev : [...prev, created]));
        setFormData((prev) => ({ ...prev, zakupnik_id: created.id }));
        await refreshEntities();
        toast.success('Zakupnik je automatski kreiran iz PDF-a.');
        return created;
      }
    } catch (error) {
      console.error('Greška pri automatskom kreiranju zakupnika:', error);
      toast.error('Zakupnika nije moguće automatski kreirati. Unesite podatke ručno.');
    }
    return null;
  }, [refreshEntities]);

  useEffect(() => {
    if (contract) {
      return;
    }
    if (renewalTemplate) {
      setFormData({
        interna_oznaka: renewalTemplate.interna_oznaka,
        nekretnina_id: renewalTemplate.nekretnina_id,
        zakupnik_id: renewalTemplate.zakupnik_id,
        datum_potpisivanja: renewalTemplate.datum_potpisivanja,
        datum_pocetka: renewalTemplate.datum_pocetka,
        datum_zavrsetka: renewalTemplate.datum_zavrsetka,
        trajanje_mjeseci: renewalTemplate.trajanje_mjeseci.toString(),
        rok_otkaza_dani: renewalTemplate.rok_otkaza_dani,
        osnovna_zakupnina: renewalTemplate.osnovna_zakupnina.toString(),
        zakupnina_po_m2: renewalTemplate.zakupnina_po_m2?.toString() || '',
        cam_troskovi: renewalTemplate.cam_troskovi?.toString() || '',
        polog_depozit: renewalTemplate.polog_depozit?.toString() || '',
        garancija: renewalTemplate.garancija?.toString() || '',
        indeksacija: renewalTemplate.indeksacija,
        indeks: renewalTemplate.indeks || '',
        formula_indeksacije: renewalTemplate.formula_indeksacije || '',
        obveze_odrzavanja: renewalTemplate.obveze_odrzavanja || '',
        namjena_prostora: renewalTemplate.namjena_prostora || '',
        rezije_brojila: renewalTemplate.rezije_brojila || ''
      });
    }
  }, [renewalTemplate, contract]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setUploadedFile(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Molimo odaberite PDF datoteku');
      event.target.value = '';
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);
    toast.dismiss('contract-pdf-parse');
    toast.loading('Analiziram PDF ugovora…', {
      description: file.name,
      id: 'contract-pdf-parse',
    });

    try {
      const response = await api.parsePdfContract(file);

      if (!response.data.success) {
        toast.error(response.data.message || 'Greška pri analizi PDF-a');
        return;
      }

      const parsedData = response.data.data || {};
      const ugovor = parsedData.ugovor || {};
      const financije = parsedData.financije || {};
      const ostalo = parsedData.ostalo || {};
      const propertySuggestion = parsedData.nekretnina || {};
      const tenantSuggestion = parsedData.zakupnik || {};
      const propertyUnitSuggestion = parsedData.property_unit || {};
      const matchedPropertyUnit = response.data.matched_property_unit || null;
      const createdPropertyUnit = response.data.created_property_unit || null;

      const propertyMatch = findPropertyMatch(propertySuggestion);
      const tenantMatch = findTenantMatch(tenantSuggestion);
      const tenantMatchStatus = tenantMatch ? (tenantMatch.status || 'aktivan') : null;
      const tenantMatchIsArchived = tenantMatchStatus === 'arhiviran';

      let inferredPropertyUnitId = '';

      if (createdPropertyUnit && propertyMatch && createdPropertyUnit.nekretnina_id === propertyMatch.id) {
        latestCreatedUnitRef.current = createdPropertyUnit;
        inferredPropertyUnitId = createdPropertyUnit.id;
        await refreshEntities();
        toast.success(`Podprostor ${createdPropertyUnit.oznaka || createdPropertyUnit.naziv || createdPropertyUnit.id} je automatski kreiran.`);
      } else if (matchedPropertyUnit && propertyMatch && matchedPropertyUnit.nekretnina_id === propertyMatch.id) {
        inferredPropertyUnitId = matchedPropertyUnit.id;
        toast.success(`Podprostor ${matchedPropertyUnit.oznaka || matchedPropertyUnit.naziv || matchedPropertyUnit.id} je povezan s ugovorom.`);
      } else if (propertyMatch && (propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv)) {
        const localMatch = findPropertyUnitMatch(propertyMatch.id, propertyUnitSuggestion);
        if (localMatch) {
          inferredPropertyUnitId = localMatch.id;
          toast.info(`Podprostor ${localMatch.oznaka || localMatch.naziv} je povezan s ugovorom.`);
        } else {
          toast.warning(`AI je identificirao podprostor ${propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv}, ali nije pronađen u sustavu.`);
        }
      } else if ((propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv) && !propertyMatch) {
        toast.info('AI je prepoznao podprostor, ali nije pronašao odgovarajuću nekretninu.');
      }

      setFormData((prevData) => {
        const nextData = {
          ...prevData,
          interna_oznaka: ugovor.interna_oznaka || prevData.interna_oznaka,
          datum_potpisivanja: ugovor.datum_potpisivanja || prevData.datum_potpisivanja,
          datum_pocetka: ugovor.datum_pocetka || prevData.datum_pocetka,
          datum_zavrsetka: ugovor.datum_zavrsetka || prevData.datum_zavrsetka,
          trajanje_mjeseci: ugovor.trajanje_mjeseci?.toString() || prevData.trajanje_mjeseci,
          rok_otkaza_dani: ugovor.rok_otkaza_dani || prevData.rok_otkaza_dani,
          osnovna_zakupnina: financije.osnovna_zakupnina?.toString() || prevData.osnovna_zakupnina,
          zakupnina_po_m2: financije.zakupnina_po_m2?.toString() || prevData.zakupnina_po_m2,
          cam_troskovi: financije.cam_troskovi?.toString() || prevData.cam_troskovi,
          polog_depozit: financije.polog_depozit?.toString() || prevData.polog_depozit,
          garancija: financije.garancija?.toString() || prevData.garancija,
          indeksacija: financije.indeksacija !== null ? financije.indeksacija : prevData.indeksacija,
          indeks: financije.indeks || prevData.indeks,
          formula_indeksacije: financije.formula_indeksacije || prevData.formula_indeksacije,
          obveze_odrzavanja: ostalo.obveze_odrzavanja || prevData.obveze_odrzavanja,
          namjena_prostora: parsedData.nekretnina?.namjena_prostora || prevData.namjena_prostora,
          rezije_brojila: ostalo.rezije_brojila || prevData.rezije_brojila,
          nekretnina_id: propertyMatch ? propertyMatch.id : prevData.nekretnina_id,
          zakupnik_id: tenantMatch && !tenantMatchIsArchived ? tenantMatch.id : prevData.zakupnik_id,
        };

        if (inferredPropertyUnitId) {
          nextData.property_unit_id = inferredPropertyUnitId;
        }

        return nextData;
      });

      if ((!tenantMatch || tenantMatchIsArchived) && (tenantSuggestion.naziv_firme || tenantSuggestion.ime_prezime)) {
        await createTenantFromSuggestion(tenantSuggestion);
      }

      toast.success('PDF ugovor je analiziran i podaci su uneseni u formu!');
    } catch (error) {
      console.error('Greška pri analizi PDF-a:', error);
      toast.error('Greška pri analizi PDF ugovora. Molimo unesite podatke ručno.');
    } finally {
      toast.dismiss('contract-pdf-parse');
      setIsParsing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    document.getElementById('pdf-upload').value = '';
    setFormData((prev) => ({ ...prev, file: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      trajanje_mjeseci: parseInt(formData.trajanje_mjeseci),
      rok_otkaza_dani: parseInt(formData.rok_otkaza_dani),
      osnovna_zakupnina: parseFloat(formData.osnovna_zakupnina),
      zakupnina_po_m2: formData.zakupnina_po_m2 ? parseFloat(formData.zakupnina_po_m2) : null,
      cam_troskovi: formData.cam_troskovi ? parseFloat(formData.cam_troskovi) : null,
      polog_depozit: formData.polog_depozit ? parseFloat(formData.polog_depozit) : null,
      garancija: formData.garancija ? parseFloat(formData.garancija) : null,
      property_unit_id: formData.property_unit_id || null,
    };
    
    // Ako je renewal, arhiviraj stari ugovor
    if (renewalTemplate?._isRenewal && renewalTemplate._oldContractId) {
      try {
        await api.updateStatusUgovora(renewalTemplate._oldContractId, 'arhivirano');
        toast.info('Stari ugovor je uspješno arhiviran');
      } catch (error) {
        console.error('Greška pri arhiviranju starog ugovora:', error);
        toast.warning('Novi ugovor je kreiran, ali stari nije arhiviran automatski');
      }
    }
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="ugovor-form">
      {/* PDF Upload Section */}
      <div className="border-2 border-dashed border-border/50 rounded-lg p-4 bg-primary/5">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            📄 AI Analiza PDF Ugovora
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Učitajte postojeći PDF ugovor za automatsko popunjavanje forme
          </p>
          
          {!uploadedFile ? (
            <div>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isParsing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('pdf-upload').click()}
                disabled={isParsing}
                className="mb-2"
              >
                {isParsing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Analiziram PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Odaberite PDF ugovor
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {uploadedFile.name}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveFile}
                disabled={isParsing}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground/80 mt-2">
            Podržani format: PDF • AI će pokušati izvući podatke iz ugovora
          </p>
        </div>
      </div>

      <Tabs defaultValue="osnovni" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
          <TabsTrigger value="financije">Financije</TabsTrigger>
          <TabsTrigger value="uvjeti">Uvjeti</TabsTrigger>
        </TabsList>
        
        <TabsContent value="osnovni" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="interna_oznaka">Interna oznaka ugovora *</Label>
              <Input
                id="interna_oznaka"
                value={formData.interna_oznaka}
                onChange={(e) => setFormData({ ...formData, interna_oznaka: e.target.value })}
                data-testid="ugovor-oznaka-input"
                placeholder="npr. UG-2025-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="datum_potpisivanja">Datum potpisivanja *</Label>
              <Input
                id="datum_potpisivanja"
                type="date"
                value={formData.datum_potpisivanja}
                onChange={(e) => setFormData({ ...formData, datum_potpisivanja: e.target.value })}
                data-testid="ugovor-potpis-input"
                required
              />
            </div>
          </div>

          <LinkedEntitySelect
            label="Nekretnina *"
            placeholder="Izaberite nekretninu"
          entities={nekretnine}
          value={formData.nekretnina_id}
          onChange={(value) => setFormData((prev) => ({
            ...prev,
            nekretnina_id: value,
            property_unit_id:
              value && prev.property_unit_id && propertyUnitsById?.[prev.property_unit_id]?.nekretnina_id === value
                ? prev.property_unit_id
                : '',
          }))}
          renderLabel={(nekretnina) => `${nekretnina.naziv} - ${nekretnina.adresa}`}
          testId="ugovor-nekretnina-select"
          allowNone={false}
        />

          <LinkedEntitySelect
            label="Podprostor / jedinica"
            placeholder={formData.nekretnina_id ? 'Poveži podprostor' : 'Odaberite nekretninu za popis jedinica'}
            entities={unitsForSelectedProperty}
            value={formData.property_unit_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, property_unit_id: value }))}
            renderLabel={(unit) => `${getUnitDisplayName(unit)} • ${formatUnitStatus(unit.status)} • ${resolveUnitTenantName(unit, tenantsById)}`}
            testId="ugovor-unit-select"
            disabled={!formData.nekretnina_id}
          />

          <LinkedEntitySelect
            label="Zakupnik *"
            placeholder="Izaberite zakupnika"
            entities={activeTenantOptions}
            value={formData.zakupnik_id}
            onChange={(value) => setFormData({ ...formData, zakupnik_id: value })}
            renderLabel={(zakupnik) => `${zakupnik.naziv_firme || zakupnik.ime_prezime} - ${zakupnik.oib}`}
            testId="ugovor-zakupnik-select"
            allowNone={false}
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="datum_pocetka">Početak zakupa *</Label>
              <Input
                id="datum_pocetka"
                type="date"
                value={formData.datum_pocetka}
                onChange={(e) => setFormData({ ...formData, datum_pocetka: e.target.value })}
                data-testid="ugovor-pocetak-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="datum_zavrsetka">Završetak zakupa *</Label>
              <Input
                id="datum_zavrsetka"
                type="date"
                value={formData.datum_zavrsetka}
                onChange={(e) => setFormData({ ...formData, datum_zavrsetka: e.target.value })}
                data-testid="ugovor-zavrsetak-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="trajanje_mjeseci">Trajanje (mjeseci) *</Label>
              <Input
                id="trajanje_mjeseci"
                type="number"
                value={formData.trajanje_mjeseci}
                onChange={(e) => setFormData({ ...formData, trajanje_mjeseci: e.target.value })}
                data-testid="ugovor-trajanje-input"
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financije" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="osnovna_zakupnina">Osnovna zakupnina (€/mjesec) *</Label>
              <Input
                id="osnovna_zakupnina"
                type="number"
                step="0.01"
                value={formData.osnovna_zakupnina}
                onChange={(e) => setFormData({ ...formData, osnovna_zakupnina: e.target.value })}
                data-testid="ugovor-zakupnina-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="zakupnina_po_m2">Zakupnina po m² (€/m²)</Label>
              <Input
                id="zakupnina_po_m2"
                type="number"
                step="0.01"
                value={formData.zakupnina_po_m2}
                onChange={(e) => setFormData({ ...formData, zakupnina_po_m2: e.target.value })}
                data-testid="ugovor-m2-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cam_troskovi">CAM troškovi (€)</Label>
              <Input
                id="cam_troskovi"
                type="number"
                step="0.01"
                value={formData.cam_troskovi}
                onChange={(e) => setFormData({ ...formData, cam_troskovi: e.target.value })}
                data-testid="ugovor-cam-input"
              />
            </div>
            <div>
              <Label htmlFor="polog_depozit">Polog/Depozit (€)</Label>
              <Input
                id="polog_depozit"
                type="number"
                step="0.01"
                value={formData.polog_depozit}
                onChange={(e) => setFormData({ ...formData, polog_depozit: e.target.value })}
                data-testid="ugovor-polog-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="garancija">Garancija (€)</Label>
            <Input
              id="garancija"
              type="number"
              step="0.01"
              value={formData.garancija}
              onChange={(e) => setFormData({ ...formData, garancija: e.target.value })}
              data-testid="ugovor-garancija-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="indeksacija"
                checked={formData.indeksacija}
                onChange={(e) => setFormData({ ...formData, indeksacija: e.target.checked })}
                data-testid="ugovor-indeksacija-checkbox"
              />
              <Label htmlFor="indeksacija">Indeksacija</Label>
            </div>
            {formData.indeksacija && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <Label htmlFor="indeks">Indeks</Label>
                  <Input
                    id="indeks"
                    value={formData.indeks}
                    onChange={(e) => setFormData({ ...formData, indeks: e.target.value })}
                    data-testid="ugovor-indeks-input"
                    placeholder="npr. potrošačke cijene"
                  />
                </div>
                <div>
                  <Label htmlFor="formula_indeksacije">Formula</Label>
                  <Input
                    id="formula_indeksacije"
                    value={formData.formula_indeksacije}
                    onChange={(e) => setFormData({ ...formData, formula_indeksacije: e.target.value })}
                    data-testid="ugovor-formula-input"
                    placeholder="npr. godišnje +3%"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="uvjeti" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rok_otkaza_dani">Rok otkaza (dani)</Label>
              <Input
                id="rok_otkaza_dani"
                type="number"
                value={formData.rok_otkaza_dani}
                onChange={(e) => setFormData({ ...formData, rok_otkaza_dani: e.target.value })}
                data-testid="ugovor-otkaz-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="obveze_odrzavanja">Obveze održavanja</Label>
            <Select value={formData.obveze_odrzavanja} onValueChange={(value) => setFormData({ ...formData, obveze_odrzavanja: value })}>
              <SelectTrigger data-testid="ugovor-odrzavanje-select">
                <SelectValue placeholder="Izaberite odgovorno lice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zakupodavac">Zakupodavac</SelectItem>
                <SelectItem value="zakupnik">Zakupnik</SelectItem>
                <SelectItem value="podijeljeno">Podijeljeno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="namjena_prostora">Namjena prostora</Label>
            <Input
              id="namjena_prostora"
              value={formData.namjena_prostora}
              onChange={(e) => setFormData({ ...formData, namjena_prostora: e.target.value })}
              data-testid="ugovor-namjena-input"
              placeholder="npr. uredski prostor, trgovina"
            />
          </div>

          <div>
            <Label htmlFor="rezije_brojila">Režije i brojila</Label>
            <Textarea
              id="rezije_brojila"
              value={formData.rezije_brojila}
              onChange={(e) => setFormData({ ...formData, rezije_brojila: e.target.value })}
              data-testid="ugovor-rezije-input"
              placeholder="Opišite režijske troškove i brojila"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-ugovor-form">
          {renewalTemplate ? 'Kreiraj produžetak' : 'Kreiraj ugovor'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-ugovor-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Dokumenti Component
const Dokumenti = () => {
  const { dokumenti, nekretnine, zakupnici, ugovori, propertyUnitsByProperty, propertyUnitsById, loading: storeLoading, refresh } = useEntityStore();
  const [isMutating, setIsMutating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('svi');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  useEffect(() => {
    if (!storeLoading) {
      setInitialLoadComplete(true);
    }
  }, [storeLoading]);

  const refreshingStore = storeLoading;
  const loading = isMutating;

  const getLinkedEntity = useCallback((dokument) => {
    if (dokument.property_unit_id) {
      const unit = propertyUnitsById?.[dokument.property_unit_id];
      if (unit) {
        const property = nekretnine.find((n) => n.id === unit.nekretnina_id);
        const tenant = zakupnici.find((z) => z.id === unit.zakupnik_id);
        const descriptor = [
          getUnitDisplayName(unit),
          property?.naziv,
          tenant ? (tenant.naziv_firme || tenant.ime_prezime) : null,
        ]
          .filter(Boolean)
          .join(' • ');
        return { tip: 'Podprostor', naziv: descriptor || getUnitDisplayName(unit) };
      }
      return { tip: 'Podprostor', naziv: 'Povezana jedinica' };
    }
    if (dokument.nekretnina_id) {
      const nekretnina = nekretnine.find((n) => n.id === dokument.nekretnina_id);
      return { tip: 'Nekretnina', naziv: nekretnina?.naziv || 'Nepoznata nekretnina' };
    }
    if (dokument.zakupnik_id) {
      const zakupnik = zakupnici.find((z) => z.id === dokument.zakupnik_id);
      return { tip: 'Zakupnik', naziv: zakupnik?.naziv_firme || zakupnik?.ime_prezime || 'Nepoznat zakupnik' };
    }
    if (dokument.ugovor_id) {
      const ugovor = ugovori.find((u) => u.id === dokument.ugovor_id);
      return { tip: 'Ugovor', naziv: ugovor?.interna_oznaka || 'N/A' };
    }
    return { tip: 'Općenito', naziv: 'Nema povezanosti' };
  }, [nekretnine, zakupnici, ugovori, propertyUnitsById]);

  const filteredDokumenti = useMemo(() => {
    return dokumenti.filter((dokument) => {
      if (filterCategory !== 'svi' && dokument.tip !== filterCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const linked = getLinkedEntity(dokument);
        return (
          dokument.naziv.toLowerCase().includes(query) ||
          dokument.opis?.toLowerCase().includes(query) ||
          formatDocumentType(dokument.tip).toLowerCase().includes(query) ||
          linked.naziv?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [dokumenti, filterCategory, searchQuery, getLinkedEntity]);

  const categoryCounts = useMemo(() => {
    return dokumenti.reduce((acc, dokument) => {
      acc[dokument.tip] = (acc[dokument.tip] || 0) + 1;
      return acc;
    }, {});
  }, [dokumenti]);

  const getDocumentUrl = useCallback((dokument) => buildDocumentUrl(dokument), []);

  const handleCreateDokument = async (formData) => {
    setIsMutating(true);
    try {
      await api.createDokument(formData);
      toast.success('Dokument je uspješno dodan');
      await refresh();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri dodavanju dokumenta:', error);
      const message = error.response?.data?.detail || 'Greška pri dodavanju dokumenta';
      toast.error(message);
      throw error;
    } finally {
      setIsMutating(false);
    }
  };

  const handleDocumentPreview = (dokument) => {
    setPreviewDocument(dokument);
    setShowPreviewDialog(true);
  };

  if (!initialLoadComplete && refreshingStore) {
    return <div className="p-8">Učitava dokumente...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {refreshingStore && initialLoadComplete && (
        <div className="text-xs text-gray-400">Osvježavanje podataka...</div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dokumenti</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Pretraži dokumente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
              data-testid="search-documents-input"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <Button onClick={() => setShowCreateForm(true)} data-testid="dodaj-dokument-btn">
            <Plus className="w-4 h-4 mr-2" />
            Dodaj dokument
          </Button>
        </div>
      </div>

      <div className="flex space-x-2 flex-wrap">
        <Button
          variant={filterCategory === 'svi' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('svi')}
          size="sm"
        >
          Svi ({dokumenti.length})
        </Button>
        <Button
          variant={filterCategory === 'ugovor' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('ugovor')}
          size="sm"
        >
          Ugovori ({categoryCounts.ugovor || 0})
        </Button>
        <Button
          variant={filterCategory === 'zemljisnoknjizni_izvadak' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('zemljisnoknjizni_izvadak')}
          size="sm"
        >
          Z.K. izvadci ({categoryCounts.zemljisnoknjizni_izvadak || 0})
        </Button>
        <Button
          variant={filterCategory === 'osiguranje' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('osiguranje')}
          size="sm"
        >
          Osiguranja ({categoryCounts.osiguranje || 0})
        </Button>
        <Button
          variant={filterCategory === 'certifikat' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('certifikat')}
          size="sm"
        >
          Certifikati ({categoryCounts.certifikat || 0})
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDokumenti.map((dokument) => {
          const linkedEntity = getLinkedEntity(dokument);
          return (
            <Card key={dokument.id} data-testid={`dokument-card-${dokument.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{dokument.naziv}</span>
                  <Badge variant="outline">{formatDocumentType(dokument.tip)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Vezano za:</span> {linkedEntity.tip}
                </p>
                <p className="text-sm text-blue-600 truncate" title={linkedEntity.naziv}>
                  {linkedEntity.naziv}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Datum:</span> {new Date(dokument.kreiran).toLocaleDateString()}
                </p>
                {dokument.opis && <p className="text-sm text-muted-foreground">{dokument.opis}</p>}
                <div className="pt-2 flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDocumentPreview(dokument)}
                    data-testid={`preview-document-${dokument.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" /> Pregledaj
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const url = getDocumentUrl(dokument);
                      if (!url) {
                        toast.error('PDF datoteka nije učitana za ovaj dokument');
                        return;
                      }
                      window.open(url, '_blank', 'noopener');
                    }}
                    data-testid={`open-document-${dokument.id}`}
                    disabled={!dokument.putanja_datoteke}
                  >
                    <Download className="w-4 h-4 mr-1" /> Otvori
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="dokument-form-description"
        >
          <DialogHeader>
            <DialogTitle>Dodaj novi dokument</DialogTitle>
          </DialogHeader>
          <div id="dokument-form-description" className="sr-only">
            Forma za dodavanje dokumenta i povezivanje s entitetima
          </div>
          <DokumentForm
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            ugovori={ugovori}
            propertyUnitsByProperty={propertyUnitsByProperty}
            propertyUnitsById={propertyUnitsById}
            onSubmit={handleCreateDokument}
            onCancel={() => setShowCreateForm(false)}
            refreshEntities={refresh}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="document-preview-description">
          <DialogHeader>
            <DialogTitle>Pregled dokumenta: {previewDocument?.naziv}</DialogTitle>
          </DialogHeader>
          <div id="document-preview-description" className="sr-only">
            Pregled dokumenta u aplikaciji
          </div>

          {previewDocument && (
            <div className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Naziv:</span> {previewDocument.naziv}</div>
                  <div><span className="font-medium">Tip:</span> {formatDocumentType(previewDocument.tip)}</div>
                  <div><span className="font-medium">Datum:</span> {new Date(previewDocument.kreiran).toLocaleDateString()}</div>
                  <div><span className="font-medium">Vezano za:</span> {getLinkedEntity(previewDocument).tip}</div>
                </div>
                {previewDocument.opis && (
                  <div className="mt-3">
                    <span className="font-medium">Opis:</span>
                    <p className="mt-1 text-muted-foreground">{previewDocument.opis}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const url = getDocumentUrl(previewDocument);
                      if (!url) {
                        toast.error('PDF datoteka nije učitana za ovaj dokument');
                        return;
                      }
                      window.open(url, '_blank', 'noopener');
                    }}
                    disabled={!previewDocument.putanja_datoteke}
                    data-testid="download-document"
                  >
                    <Download className="w-4 h-4 mr-2" /> Otvori u novom prozoru
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const holder = document.querySelector('[data-document-preview]');
                      const iframe = holder ? holder.querySelector('iframe') : null;
                      const url = getDocumentUrl(previewDocument);
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        return;
                      }
                      if (url) {
                        const printWindow = window.open(url, '_blank', 'noopener');
                        if (printWindow) {
                          printWindow.addEventListener('load', () => printWindow.print(), { once: true });
                        }
                      } else {
                        toast.error('PDF datoteka nije učitana za ovaj dokument');
                      }
                    }}
                    disabled={!previewDocument.putanja_datoteke}
                    data-testid="print-document"
                  >
                    <Printer className="w-4 h-4 mr-2" /> Ispiši
                  </Button>
                </div>
                </div>
                <DocumentViewer dokument={previewDocument} />
                <div className="text-xs text-muted-foreground/80">
                  Datoteka: {previewDocument.putanja_datoteke || 'Nije prenesena'}
                  {previewDocument.velicina_datoteke > 0 && (
                    <> • Veličina: {(previewDocument.velicina_datoteke / 1024).toFixed(1)} KB</>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)} className="flex-1">
                  Zatvori
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const emptySelectValue = 'none';

const normalizeSelectValue = (value) => (value === emptySelectValue ? '' : value);


const LinkedEntitySelect = ({ label, placeholder, entities, value, onChange, renderLabel, testId, allowNone = true, disabled = false }) => {
  const selectValue = allowNone ? (value || emptySelectValue) : (value || undefined);
  const handleChange = (selected) => {
    if (disabled) {
      return;
    }
    if (allowNone) {
      onChange(normalizeSelectValue(selected));
    } else {
      onChange(selected);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <Select value={selectValue} onValueChange={handleChange}>
        <SelectTrigger data-testid={testId} disabled={disabled}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={emptySelectValue}>{placeholder}</SelectItem>}
          {entities.map((entity) => (
            <SelectItem key={entity.id} value={entity.id}>
              {renderLabel ? renderLabel(entity) : entity.naziv || entity.interna_oznaka}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const DokumentForm = ({ nekretnine, zakupnici, ugovori, propertyUnitsByProperty = {}, propertyUnitsById = {}, onSubmit, onCancel, refreshEntities, loading }) => {
  const fileInputRef = useRef(null);
  const latestCreatedUnitRef = useRef(null);
  const initialFormState = {
    naziv: '',
    tip: 'ugovor',
    opis: '',
    nekretnina_id: '',
    zakupnik_id: '',
    ugovor_id: '',
    property_unit_id: '',
    file: null,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState({ property: false, tenant: false, contract: false });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [tenantOptions, setTenantOptions] = useState(zakupnici);

  useEffect(() => {
    if (contract) {
      setAiSuggestions(null);
      setAiError(null);
      setQuickCreateLoading({ property: false, tenant: false, contract: false });
    }
  }, [contract]);

  const activeTenantOptions = useMemo(
    () => tenantOptions.filter((tenant) => (tenant.status || 'aktivan') !== 'arhiviran'),
    [tenantOptions]
  );

  const tenantsById = useMemo(() => Object.fromEntries(zakupnici.map((tenant) => [tenant.id, tenant])), [zakupnici]);

  const contractsForProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return ugovori;
    }
    return ugovori.filter((contract) => contract.nekretnina_id === formData.nekretnina_id);
  }, [ugovori, formData.nekretnina_id]);

  const unitsForSelectedProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return [];
    }
    return sortUnitsByPosition(propertyUnitsByProperty[formData.nekretnina_id] || []);
  }, [formData.nekretnina_id, propertyUnitsByProperty]);

  const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const toNumberOrNull = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const normalize = (value) => (value ? value.toString().trim().toLowerCase() : '');

  const findPropertyMatch = useCallback((suggestion) => {
    if (!suggestion) return null;
    const name = normalize(suggestion.naziv);
    const address = normalize(suggestion.adresa);
    if (!name && !address) return null;
    return nekretnine.find((item) => {
      const itemName = normalize(item.naziv);
      const itemAddress = normalize(item.adresa);
      if (name && itemName === name) return true;
      if (address && itemAddress === address) return true;
      if (name && itemName.includes(name)) return true;
      if (address && itemAddress.includes(address)) return true;
      return false;
    }) || null;
  }, [nekretnine]);

  const findPropertyUnitMatch = useCallback((propertyId, suggestion) => {
    if (!propertyId || !suggestion) {
      return null;
    }
    const targetOznaka = normalize(suggestion.oznaka);
    const targetNaziv = normalize(suggestion.naziv);
    if (!targetOznaka && !targetNaziv) {
      return null;
    }
    const units = propertyUnitsByProperty?.[propertyId] || [];
    return (
      units.find((unit) => {
        const unitOznaka = normalize(unit.oznaka);
        const unitNaziv = normalize(unit.naziv);
        if (targetOznaka && unitOznaka === targetOznaka) {
          return true;
        }
        if (targetNaziv && unitNaziv === targetNaziv) {
          return true;
        }
        return false;
      }) || null
    );
  }, [propertyUnitsByProperty]);

  const findTenantMatch = useCallback((suggestion) => {
    if (!suggestion) return null;
    const name = normalize(suggestion.naziv_firme || suggestion.ime_prezime);
    const oib = normalize(suggestion.oib);
    return tenantOptions.find((item) => {
      const itemName = normalize(item.naziv_firme || item.ime_prezime);
      const itemOib = normalize(item.oib);
      if (oib && itemOib === oib) return true;
      if (name && itemName === name) return true;
      if (name && itemName.includes(name)) return true;
      return false;
    }) || null;
  }, [tenantOptions]);

  const findContractMatch = useCallback((suggestion) => {
    if (!suggestion) return null;
    const oznaka = normalize(suggestion.interna_oznaka);
    if (!oznaka) return null;
    return ugovori.find((item) => normalize(item.interna_oznaka) === oznaka) || null;
  }, [ugovori]);

  const matchedProperty = useMemo(() => findPropertyMatch(aiSuggestions?.nekretnina), [aiSuggestions, findPropertyMatch]);
  const matchedTenant = useMemo(() => findTenantMatch(aiSuggestions?.zakupnik), [aiSuggestions, findTenantMatch]);
  const matchedContract = useMemo(() => findContractMatch(aiSuggestions?.ugovor), [aiSuggestions, findContractMatch]);
  const aiSuggestionDocumentType = aiSuggestions ? resolveDocumentType(aiSuggestions.document_type) : null;
  const aiSuggestionIsPropertyDoc = aiSuggestionDocumentType ? PROPERTY_DOCUMENT_TYPES.has(aiSuggestionDocumentType) : false;
  const aiSuggestionIsContractDoc = aiSuggestionDocumentType ? CONTRACT_DOCUMENT_TYPES.has(aiSuggestionDocumentType) : false;

  useEffect(() => {
    if (!formData.property_unit_id) {
      return;
    }
    const fallbackUnit =
      latestCreatedUnitRef.current && latestCreatedUnitRef.current.id === formData.property_unit_id
        ? latestCreatedUnitRef.current
        : null;
    const unit = propertyUnitsById?.[formData.property_unit_id] || fallbackUnit;
    if (!unit) {
      setFormData((prev) => ({ ...prev, property_unit_id: '' }));
      return;
    }
    if (formData.nekretnina_id && unit.nekretnina_id !== formData.nekretnina_id) {
      setFormData((prev) => ({ ...prev, property_unit_id: '' }));
    }
    if (propertyUnitsById?.[formData.property_unit_id]) {
      latestCreatedUnitRef.current = null;
    }
  }, [formData.nekretnina_id, formData.property_unit_id, propertyUnitsById]);

  useEffect(() => {
    if (!formData.property_unit_id) {
      return;
    }
    const fallbackUnit =
      latestCreatedUnitRef.current && latestCreatedUnitRef.current.id === formData.property_unit_id
        ? latestCreatedUnitRef.current
        : null;
    const unit = propertyUnitsById?.[formData.property_unit_id] || fallbackUnit;
    if (!unit) {
      return;
    }
    setFormData((prev) => {
      const updates = {};
      if (!prev.nekretnina_id && unit.nekretnina_id) {
        updates.nekretnina_id = unit.nekretnina_id;
      }
      if (!prev.zakupnik_id && unit.zakupnik_id) {
        updates.zakupnik_id = unit.zakupnik_id;
      }
      if (!prev.ugovor_id && unit.ugovor_id) {
        updates.ugovor_id = unit.ugovor_id;
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [formData.property_unit_id, propertyUnitsById]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setAiSuggestions(null);
    setAiError(null);

    if (!file) {
      setUploadedFile(null);
      setFormData((prev) => ({ ...prev, file: null }));
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Molimo odaberite PDF datoteku');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadedFile(null);
      setFormData((prev) => ({ ...prev, file: null }));
      return;
    }

    toast.dismiss('document-pdf-parse');
    toast.loading('Analiziram PDF dokument…', {
      description: file.name,
      id: 'document-pdf-parse',
    });

    setUploadedFile(file);
    setFormData((prev) => ({ ...prev, file }));
    setAiLoading(true);
    try {
      const response = await api.parsePdfContract(file);
      const payload = response.data;
      if (!payload.success) {
        setAiError(payload.message || 'AI analiza PDF-a nije uspjela');
        toast.error(payload.message || 'AI analiza PDF-a nije uspjela');
        return;
      }

      const suggestions = payload.data || {};
      setAiSuggestions(suggestions);

      const contract = suggestions.ugovor || {};
      const finances = suggestions.financije || {};
      const propertySuggestion = suggestions.nekretnina || {};
      const tenantSuggestion = suggestions.zakupnik || {};
      const propertyUnitSuggestion = suggestions.property_unit || {};
      const propertyMatch = findPropertyMatch(propertySuggestion);
      const tenantMatch = findTenantMatch(tenantSuggestion);
      const contractMatch = findContractMatch(contract);
      const tenantMatchStatus = tenantMatch ? (tenantMatch.status || 'aktivan') : null;
      const tenantMatchIsArchived = tenantMatchStatus === 'arhiviran';
      const documentType = resolveDocumentType(suggestions.document_type);
      const isPropertyDoc = PROPERTY_DOCUMENT_TYPES.has(documentType);
      const isContractDoc = CONTRACT_DOCUMENT_TYPES.has(documentType);
      const matchedPropertyUnit = payload.matched_property_unit || null;
      const createdPropertyUnit = payload.created_property_unit || null;

      let inferredPropertyUnitId = '';

      if (createdPropertyUnit && propertyMatch && createdPropertyUnit.nekretnina_id === propertyMatch.id) {
        latestCreatedUnitRef.current = createdPropertyUnit;
        inferredPropertyUnitId = createdPropertyUnit.id;
        await refreshEntities();
        toast.success(`Podprostor ${createdPropertyUnit.oznaka || createdPropertyUnit.naziv || createdPropertyUnit.id} je automatski kreiran.`);
      } else if (matchedPropertyUnit && propertyMatch && matchedPropertyUnit.nekretnina_id === propertyMatch.id) {
        inferredPropertyUnitId = matchedPropertyUnit.id;
        toast.success(`Podprostor ${matchedPropertyUnit.oznaka || matchedPropertyUnit.naziv || matchedPropertyUnit.id} je povezan s dokumentom.`);
      } else if (propertyMatch && (propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv)) {
        const localMatch = findPropertyUnitMatch(propertyMatch.id, propertyUnitSuggestion);
        if (localMatch) {
          inferredPropertyUnitId = localMatch.id;
          toast.info(`Podprostor ${localMatch.oznaka || localMatch.naziv} je povezan s dokumentom.`);
        } else {
          toast.warning(`AI je identificirao podprostor ${propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv}, ali ga nije pronašao u sustavu.`);
        }
      } else if ((propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv) && !propertyMatch) {
        toast.info('AI je prepoznao podprostor, ali nije pronašao odgovarajuću nekretninu.');
      }

      const suggestedName = (() => {
        if (documentType === 'racun' && suggestions.racun?.broj_racuna) {
          return `Račun ${suggestions.racun.broj_racuna}`;
        }
        if (documentType === 'aneks' && contract.interna_oznaka) {
          return `Aneks ${contract.interna_oznaka}`;
        }
        if (documentType === 'ugovor' && contract.interna_oznaka) {
          return `Ugovor ${contract.interna_oznaka}`;
        }
        if (isPropertyDoc) {
          const propertyLabel = propertyMatch?.naziv || propertySuggestion.naziv;
          if (propertyLabel) {
            const docLabel = DOCUMENT_TYPE_LABELS[documentType] || formatDocumentType(documentType);
            return `${docLabel} – ${propertyLabel}`;
          }
        }
        return null;
      })();

      setFormData((prev) => {
        const updated = { ...prev, tip: documentType };

        if (!prev.naziv && suggestedName) {
          updated.naziv = suggestedName;
        }

        if (propertyMatch) {
          updated.nekretnina_id = propertyMatch.id;
        } else if (isContractDoc && contractMatch?.nekretnina_id) {
          updated.nekretnina_id = contractMatch.nekretnina_id;
        }

        if (!prev.opis && !isPropertyDoc) {
          const descriptionSource = tenantSuggestion.naziv_firme || tenantSuggestion.ime_prezime || '';
          if (descriptionSource) {
            updated.opis = descriptionSource;
          }
        }

        if (isPropertyDoc) {
          updated.zakupnik_id = '';
          updated.ugovor_id = '';
        } else {
          if (tenantMatch && !tenantMatchIsArchived) {
            updated.zakupnik_id = tenantMatch.id;
          }
          if (contractMatch) {
            updated.ugovor_id = contractMatch.id;
          }
        }

        if (!prev.naziv && documentType === 'racun' && suggestions.racun?.broj_racuna) {
          updated.naziv = `Račun ${suggestions.racun.broj_racuna}`;
        }

        if (isPropertyDoc) {
          updated.property_unit_id = '';
        } else if (inferredPropertyUnitId) {
          updated.property_unit_id = inferredPropertyUnitId;
        }

        return updated;
      });

      if (!isPropertyDoc && (!tenantMatch || tenantMatchIsArchived) && (tenantSuggestion.naziv_firme || tenantSuggestion.ime_prezime)) {
        await handleCreateTenantFromAI(tenantSuggestion);
      }
      toast.success('AI prijedlozi spremni – provjerite prijedloge ispod.');
    } catch (error) {
      console.error('AI analiza dokumenta nije uspjela:', error);
      const message = error.response?.data?.detail || 'Greška pri AI analizi dokumenta';
      setAiError(message);
      toast.error(message);
    } finally {
      toast.dismiss('document-pdf-parse');
      setAiLoading(false);
    }
  };

  const handleCreatePropertyFromAI = async () => {
    if (!aiSuggestions?.nekretnina) return;
    setQuickCreateLoading((prev) => ({ ...prev, property: true }));
    const suggestion = aiSuggestions.nekretnina;
    try {
      const payload = {
        naziv: suggestion.naziv || `Nekretnina ${Date.now()}`,
        adresa: suggestion.adresa || 'Nepoznata adresa',
        katastarska_opcina: suggestion.katastarska_opcina || 'Nepoznata općina',
        broj_kat_cestice: suggestion.broj_kat_cestice || 'N/A',
        vrsta: suggestion.vrsta || 'ostalo',
        povrsina: toNumber(suggestion.povrsina, 0),
        godina_izgradnje: suggestion.godina_izgradnje || null,
        vlasnik: suggestion.vlasnik || 'Nepoznat vlasnik',
        udio_vlasnistva: suggestion.udio_vlasnistva || '1/1',
        nabavna_cijena: toNumberOrNull(suggestion.nabavna_cijena),
        trzisna_vrijednost: toNumberOrNull(suggestion.trzisna_vrijednost),
        prosllogodisnji_prihodi: toNumberOrNull(suggestion.prosllogodisnji_prihodi),
        prosllogodisnji_rashodi: toNumberOrNull(suggestion.prosllogodisnji_rashodi),
        amortizacija: toNumberOrNull(suggestion.amortizacija),
        proslogodisnji_neto_prihod: toNumberOrNull(suggestion.proslogodisnji_neto_prihod || suggestion.neto_prihod),
        zadnja_obnova: suggestion.zadnja_obnova || null,
        potrebna_ulaganja: suggestion.potrebna_ulaganja || null,
        troskovi_odrzavanja: toNumberOrNull(suggestion.troskovi_odrzavanja),
        osiguranje: suggestion.osiguranje || null,
        sudski_sporovi: suggestion.sudski_sporovi || null,
        hipoteke: suggestion.hipoteke || null,
        napomene: suggestion.napomene || null,
      };
      const response = await api.createNekretnina(payload);
      toast.success('Nekretnina je kreirana iz AI prijedloga');
      await refreshEntities();
      setFormData((prev) => ({ ...prev, nekretnina_id: response.data.id }));
    } catch (error) {
      console.error('Greška pri kreiranju nekretnine iz AI prijedloga:', error);
      toast.error('Greška pri kreiranju nekretnine');
    } finally {
      setQuickCreateLoading((prev) => ({ ...prev, property: false }));
    }
  };

  const handleCreateTenantFromAI = async (suggestionOverride = null) => {
    const suggestion = suggestionOverride || aiSuggestions?.zakupnik;
    if (!suggestion) return;
    setQuickCreateLoading((prev) => ({ ...prev, tenant: true }));
    try {
      const payload = {
        naziv_firme: suggestion.naziv_firme || null,
        ime_prezime: suggestion.ime_prezime || null,
        oib: suggestion.oib || `N/A-${Date.now()}`,
        sjediste: suggestion.sjediste || 'Nije navedeno',
        kontakt_ime: suggestion.kontakt_ime || suggestion.naziv_firme || suggestion.ime_prezime || 'Kontakt osoba',
        kontakt_email: suggestion.kontakt_email || 'kontakt@nedefinirano.hr',
        kontakt_telefon: suggestion.kontakt_telefon || '000-000-000',
        iban: suggestion.iban || '',
      };
      const response = await api.createZakupnik(payload);
      const created = response.data;
      toast.success('Zakupnik je kreiran iz AI prijedloga');
      await refreshEntities();
      if (created?.id) {
        setTenantOptions((prev) => (prev.some((item) => item.id === created.id) ? prev : [...prev, created]));
        setFormData((prev) => ({ ...prev, zakupnik_id: created.id }));
      }
    } catch (error) {
      console.error('Greška pri kreiranju zakupnika iz AI prijedloga:', error);
      toast.error('Greška pri kreiranju zakupnika');
    } finally {
      setQuickCreateLoading((prev) => ({ ...prev, tenant: false }));
    }
  };

  const handleCreateContractFromAI = async () => {
    if (!aiSuggestions?.ugovor) {
      toast.error('AI nije pronašao podatke o ugovoru');
      return;
    }
    if (!formData.nekretnina_id || !formData.zakupnik_id) {
      toast.error('Povežite nekretninu i zakupnika prije kreiranja ugovora');
      return;
    }
    setQuickCreateLoading((prev) => ({ ...prev, contract: true }));
    const contract = aiSuggestions.ugovor || {};
    const finances = aiSuggestions.financije || {};
    const other = aiSuggestions.ostalo || {};
    try {
      const today = new Date().toISOString().split('T')[0];
     const payload = {
       interna_oznaka: contract.interna_oznaka || `UG-${Date.now()}`,
       nekretnina_id: formData.nekretnina_id,
       zakupnik_id: formData.zakupnik_id,
       datum_potpisivanja: contract.datum_potpisivanja || today,
       datum_pocetka: contract.datum_pocetka || today,
       datum_zavrsetka: contract.datum_zavrsetka || today,
        trajanje_mjeseci: contract.trajanje_mjeseci || 12,
        rok_otkaza_dani: contract.rok_otkaza_dani || 30,
        osnovna_zakupnina: toNumber(finances.osnovna_zakupnina, 0),
        zakupnina_po_m2: toNumberOrNull(finances.zakupnina_po_m2),
        cam_troskovi: toNumberOrNull(finances.cam_troskovi),
        polog_depozit: toNumberOrNull(finances.polog_depozit),
        garancija: toNumberOrNull(finances.garancija),
        indeksacija: finances.indeksacija ?? false,
        indeks: finances.indeks || null,
        formula_indeksacije: finances.formula_indeksacije || null,
        obveze_odrzavanja: other.obveze_odrzavanja || null,
        namjena_prostora: aiSuggestions.nekretnina?.namjena_prostora || contract.namjena_prostora || '',
        rezije_brojila: other.rezije_brojila || '',
      };
      const response = await api.createUgovor(payload);
      toast.success('Ugovor je kreiran iz AI prijedloga');
      await refreshEntities();
      setFormData((prev) => ({
        ...prev,
        ugovor_id: response.data.id,
        naziv: prev.naziv || `Ugovor ${response.data.interna_oznaka}`,
      }));
    } catch (error) {
      console.error('Greška pri kreiranju ugovora iz AI prijedloga:', error);
      toast.error('Greška pri kreiranju ugovora');
    } finally {
      setQuickCreateLoading((prev) => ({ ...prev, contract: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      toast.error('PDF dokument je obavezan. Učitajte PDF prije spremanja.');
      return;
    }
    if (PROPERTY_DOCUMENT_TYPES.has(formData.tip) && !formData.nekretnina_id) {
      toast.error('Za ovaj tip dokumenta odaberite pripadajuću nekretninu.');
      return;
    }
    try {
      await onSubmit({
        ...formData,
        nekretnina_id: formData.nekretnina_id || null,
        zakupnik_id: formData.zakupnik_id || null,
        ugovor_id: formData.ugovor_id || null,
        property_unit_id: formData.property_unit_id || null,
      });
      setFormData({ ...initialFormState });
      setAiSuggestions(null);
      setAiError(null);
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Greška pri spremanju dokumenta:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="dokument-form">
      <div className="border-2 border-dashed border-border/50 rounded-lg bg-primary/5 p-5">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-medium text-foreground">📄 Učitaj PDF dokument</h3>
          <p className="text-sm text-muted-foreground">PDF je obavezan i koristi se za AI prijedloge, automatsko povezivanje i spremanje u arhivu.</p>
          <input
            id="dokument-pdf-upload"
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={aiLoading}
          />
          {!uploadedFile ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={aiLoading}
              className="inline-flex items-center"
            >
              {aiLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                  Analiziram PDF...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" /> Odaberite PDF
                </>
              )}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-primary">
                <FileText className="h-4 w-4" />
                {uploadedFile.name}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  setFormData((prev) => ({ ...prev, file: null }));
                  setAiSuggestions(null);
                  setAiError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={aiLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Ukloni PDF
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground/80">Podržani format: PDF</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="naziv">Naziv dokumenta *</Label>
          <Input
            id="naziv"
            value={formData.naziv}
            onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
            data-testid="dokument-naziv-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="tip">Tip dokumenta *</Label>
          <Select
            value={formData.tip}
            onValueChange={(value) =>
              setFormData((prev) => {
                const next = { ...prev, tip: value };
                if (PROPERTY_DOCUMENT_TYPES.has(value)) {
                  next.zakupnik_id = '';
                  next.ugovor_id = '';
                }
                return next;
              })
            }
          >
            <SelectTrigger data-testid="dokument-tip-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ugovor">Ugovor</SelectItem>
              <SelectItem value="racun">Račun</SelectItem>
              <SelectItem value="procjena_vrijednosti">Procjena vrijednosti</SelectItem>
              <SelectItem value="lokacijska_informacija">Lokacijska informacija</SelectItem>
              <SelectItem value="aneks">Aneks</SelectItem>
              <SelectItem value="zemljisnoknjizni_izvadak">Zemljišnoknjižni izvadak</SelectItem>
              <SelectItem value="uporabna_dozvola">Uporabna dozvola</SelectItem>
              <SelectItem value="gradevinska_dozvola">Građevinska dozvola</SelectItem>
              <SelectItem value="energetski_certifikat">Energetski certifikat</SelectItem>
              <SelectItem value="osiguranje">Osiguranje</SelectItem>
              <SelectItem value="izvadak_iz_registra">Izvadak iz registra</SelectItem>
              <SelectItem value="bon_2">BON-2</SelectItem>
              <SelectItem value="certifikat">Certifikat</SelectItem>
              <SelectItem value="ostalo">Ostalo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="opis">Opis dokumenta</Label>
        <Textarea
          id="opis"
          value={formData.opis}
          onChange={(e) => setFormData({ ...formData, opis: e.target.value })}
          data-testid="dokument-opis-input"
        />
      </div>

      {aiLoading && <div className="text-sm text-blue-600">Analiziram PDF dokument...</div>}
      {aiError && <div className="text-sm text-red-600">{aiError}</div>}

      {aiSuggestions && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-900">AI prijedlozi iz PDF-a</h4>
            <div className="flex items-center space-x-2">
              {aiSuggestions.document_type && (
                <Badge variant="outline">Vrsta: {aiSuggestions.document_type}</Badge>
              )}
              <Badge variant="outline">Eksperimentalno</Badge>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white border border-blue-100 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase">Nekretnina</p>
              <p className="text-sm text-muted-foreground">{aiSuggestions.nekretnina?.naziv || 'Nije prepoznato'}</p>
              <p className="text-xs text-muted-foreground/80">{aiSuggestions.nekretnina?.adresa}</p>
              <div className="flex flex-wrap gap-2">
                {matchedProperty ? (
                  <Badge variant="outline" className="text-green-700 border-green-300">Pronađena: {matchedProperty.naziv}</Badge>
                ) : (
                  <Badge variant="outline">Nije pronađena postojeća</Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={quickCreateLoading.property || !aiSuggestions.nekretnina}
                  onClick={() => {
                    if (matchedProperty) {
                      setFormData((prev) => ({ ...prev, nekretnina_id: matchedProperty.id }));
                      toast.success('Nekretnina je povezana');
                    } else {
                      handleCreatePropertyFromAI();
                    }
                  }}
                >
                  {quickCreateLoading.property ? 'Spremam...' : matchedProperty ? 'Poveži s pronađenom' : 'Kreiraj nekretninu'}
                </Button>
              </div>
            </div>
            {aiSuggestionIsContractDoc && (
              <div className="bg-white border border-blue-100 rounded-md p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700 uppercase">Zakupnik</p>
                <p className="text-sm text-muted-foreground">{aiSuggestions.zakupnik?.naziv_firme || aiSuggestions.zakupnik?.ime_prezime || 'Nije prepoznato'}</p>
                <p className="text-xs text-muted-foreground/80">OIB: {aiSuggestions.zakupnik?.oib || 'N/A'}</p>
                <div className="flex flex-wrap gap-2">
                  {matchedTenant ? (
                    <Badge variant="outline" className="text-green-700 border-green-300">Pronađen: {matchedTenant.naziv_firme || matchedTenant.ime_prezime}</Badge>
                  ) : (
                    <Badge variant="outline">Nije pronađen postojeći</Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={quickCreateLoading.tenant || !aiSuggestions.zakupnik}
                    onClick={() => {
                      if (matchedTenant) {
                        setFormData((prev) => ({ ...prev, zakupnik_id: matchedTenant.id }));
                        toast.success('Zakupnik je povezan');
                      } else {
                        handleCreateTenantFromAI();
                      }
                    }}
                  >
                    {quickCreateLoading.tenant ? 'Spremam...' : matchedTenant ? 'Poveži s pronađenim' : 'Kreiraj zakupnika'}
                  </Button>
                </div>
              </div>
            )}
            {aiSuggestionIsContractDoc && (
              <div className="bg-white border border-blue-100 rounded-md p-3 space-y-2 md:col-span-2">
                <p className="text-xs font-semibold text-blue-700 uppercase">Ugovor</p>
                <p className="text-sm text-muted-foreground">Oznaka: {aiSuggestions.ugovor?.interna_oznaka || 'Nije prepoznato'}</p>
                <div className="flex flex-wrap gap-2">
                  {matchedContract ? (
                    <Badge variant="outline" className="text-green-700 border-green-300">Pronađen: {matchedContract.interna_oznaka}</Badge>
                  ) : (
                    <Badge variant="outline">Nije pronađen postojeći</Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={quickCreateLoading.contract || !aiSuggestions.ugovor}
                    onClick={() => {
                      if (matchedContract) {
                        setFormData((prev) => ({ ...prev, ugovor_id: matchedContract.id }));
                        toast.success('Ugovor je povezan');
                      } else {
                        handleCreateContractFromAI();
                      }
                    }}
                  >
                    {quickCreateLoading.contract ? 'Spremam...' : matchedContract ? 'Poveži s pronađenim' : 'Kreiraj ugovor'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium">Poveži s entitetom (opcionalno)</h4>
        <LinkedEntitySelect
          label="Nekretnina"
          placeholder="Nema veze s nekretninom"
          entities={nekretnine}
          value={formData.nekretnina_id}
          onChange={(value) => setFormData((prev) => ({
            ...prev,
            nekretnina_id: value,
            property_unit_id:
              value && prev.property_unit_id && propertyUnitsById?.[prev.property_unit_id]?.nekretnina_id === value
                ? prev.property_unit_id
                : '',
            ugovor_id: value ? prev.ugovor_id : '',
          }))}
          renderLabel={(nekretnina) => `${nekretnina.naziv} - ${nekretnina.adresa}`}
          testId="dokument-nekretnina-select"
        />
        <LinkedEntitySelect
          label="Podprostor / jedinica"
          placeholder={formData.nekretnina_id ? 'Nema veze s podprostorom' : 'Odaberite nekretninu za popis jedinica'}
          entities={unitsForSelectedProperty}
          value={formData.property_unit_id}
          onChange={(value) => setFormData((prev) => ({
            ...prev,
            property_unit_id: value,
          }))}
          renderLabel={(unit) => `${getUnitDisplayName(unit)} • ${formatUnitStatus(unit.status)} • ${resolveUnitTenantName(unit, tenantsById)}`}
          testId="dokument-unit-select"
          disabled={!formData.nekretnina_id}
        />
        <LinkedEntitySelect
          label="Zakupnik"
          placeholder="Nema veze sa zakupnikom"
          entities={activeTenantOptions}
          value={formData.zakupnik_id}
          onChange={(value) => setFormData((prev) => ({
            ...prev,
            zakupnik_id: value,
            ugovor_id: value ? prev.ugovor_id : '',
          }))}
          renderLabel={(zakupnik) => `${zakupnik.naziv_firme || zakupnik.ime_prezime} - ${zakupnik.oib}`}
          testId="dokument-zakupnik-select"
          disabled={PROPERTY_DOCUMENT_TYPES.has(formData.tip)}
        />
        <LinkedEntitySelect
          label="Ugovor"
          placeholder="Nema veze s ugovorom"
          entities={contractsForProperty}
          value={formData.ugovor_id}
          onChange={(value) => setFormData({ ...formData, ugovor_id: value })}
          renderLabel={(ugovor) => ugovor.interna_oznaka}
          testId="dokument-ugovor-select"
          disabled={PROPERTY_DOCUMENT_TYPES.has(formData.tip)}
        />
      </div>

      <div className="flex space-x-2 pt-4">
        <Button type="submit" data-testid="potvrdi-dokument-form" disabled={loading}>
          {loading ? 'Spremam...' : 'Dodaj dokument'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="odustani-dokument-form">
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Main App Component
function App() {
  return (
    <EntityStoreProvider>
      <div className="App">
        <BrowserRouter>
          <Navigation />
          <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nekretnine" element={<Nekretnine />} />
          <Route path="/zakupnici" element={<Zakupnici />} />
          <Route path="/ugovori" element={<Ugovori />} />
          <Route path="/odrzavanje" element={<MaintenanceWorkspace />} />
          <Route path="/dokumenti" element={<Dokumenti />} />
        </Routes>
        </BrowserRouter>
      </div>
    </EntityStoreProvider>
  );
}

export { Zakupnici, EntityStoreContext, EntityStoreProvider };
export default App;
