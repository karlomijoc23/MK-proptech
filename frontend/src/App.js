import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { toast } from 'sonner';
import { Home, Building, Users, FileText, DollarSign, Calendar, Plus, Eye, Edit, Trash2, Search, Bell, Download, Sparkles, ArrowRight } from 'lucide-react';
import logoHorizontal from './assets/riforma-horizontal.svg';
import logoMark from './assets/riforma-icon.svg';
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
  getZakupnici: () => axios.get(`${API}/zakupnici`),
  createZakupnik: (data) => axios.post(`${API}/zakupnici`, data),
  updateZakupnik: (id, data) => axios.put(`${API}/zakupnici/${id}`, data),
  
  // Ugovori
  getUgovori: () => axios.get(`${API}/ugovori`),
  createUgovor: (data) => axios.post(`${API}/ugovori`, data),
  updateStatusUgovora: (id, status) => axios.put(`${API}/ugovori/${id}/status`, { novi_status: status }),
  
  // Dokumenti
  getDokumenti: () => axios.get(`${API}/dokumenti`),
  getDokumentiNekretnine: (id) => axios.get(`${API}/dokumenti/nekretnina/${id}`),
  getDokumentiZakupnika: (id) => axios.get(`${API}/dokumenti/zakupnik/${id}`),
  getDokumentiUgovora: (id) => axios.get(`${API}/dokumenti/ugovor/${id}`),
  createDokument: (data) => {
    const formData = new FormData();
    formData.append('naziv', data.naziv);
    formData.append('tip', data.tip);
    formData.append('uploadao', data.uploadao);

    if (data.opis) {
      formData.append('opis', data.opis);
    }

    formData.append('verzija', data.verzija || '1.0');

    if (data.nekretnina_id) {
      formData.append('nekretnina_id', data.nekretnina_id);
    }
    if (data.zakupnik_id) {
      formData.append('zakupnik_id', data.zakupnik_id);
    }
    if (data.ugovor_id) {
      formData.append('ugovor_id', data.ugovor_id);
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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const [nekRes, zakRes, ugRes, dokRes] = await Promise.all([
        api.getNekretnine(),
        api.getZakupnici(),
        api.getUgovori(),
        api.getDokumenti(),
      ]);

      setState({
        nekretnine: nekRes.data,
        zakupnici: zakRes.data,
        ugovori: ugRes.data,
        dokumenti: dokRes.data,
      });
      setError(null);
    } catch (err) {
      console.error('Greška pri učitavanju entiteta:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const value = useMemo(() => ({
    ...state,
    loading,
    error,
    refresh: loadEntities,
  }), [state, loading, error, loadEntities]);

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
    { path: '/dokumenti', icon: FileText, label: 'Dokumenti' },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoHorizontal} alt="Riforma" className="hidden h-9 w-auto sm:block" />
          <img src={logoMark} alt="Riforma" className="h-9 w-9 sm:hidden" />
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold uppercase tracking-[0.38em] text-primary/80">Riforma</span>
            <span className="text-xs font-medium text-muted-foreground">From paperwork to progress</span>
          </div>
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
        opcija_produljenja: trenutniUgovor.opcija_produljenja,
        uvjeti_produljenja: trenutniUgovor.uvjeti_produljenja,
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

  if (!dashboard) {
    return <div className="p-8">Učitava...</div>;
  }

  const documentsThisMonth = dokumenti.filter((doc) => {
    if (!doc.kreiran) return false;
    const created = new Date(doc.kreiran);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 md:px-6">
      <div className="flex flex-col gap-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Portfelj u reformi
        </span>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <Card data-testid="ukupno-nekretnina-card" className="card-hover shadow-shell">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ukupno nekretnina</CardTitle>
            <Building className="h-5 w-5 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{dashboard.ukupno_nekretnina}</div>
          </CardContent>
        </Card>

        <Card data-testid="aktivni-ugovori-card" className="card-hover shadow-shell">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktivni ugovori</CardTitle>
            <Calendar className="h-5 w-5 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{dashboard.aktivni_ugovori}</div>
          </CardContent>
        </Card>

        <Card data-testid="ugovori-na-isteku-card" className="card-hover shadow-shell">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ugovori na isteku</CardTitle>
            <Bell className="h-5 w-5 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{dashboard.ugovori_na_isteku}</div>
          </CardContent>
        </Card>

        <Card data-testid="mjesecni-prihod-card" className="card-hover shadow-shell">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mjesečni prihod</CardTitle>
            <DollarSign className="h-5 w-5 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{dashboard.mjesecni_prihod?.toLocaleString()} €</div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-shell">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dokumenti ovaj mjesec</CardTitle>
            <FileText className="h-5 w-5 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{documentsThisMonth}</div>
            <p className="text-xs font-medium text-muted-foreground/80">Nova dokumenta u posljednjih 30 dana</p>
          </CardContent>
        </Card>

        <Card data-testid="vrijednost-portfelja-card" className="border-0 bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">Vrijednost portfelja</CardTitle>
            <Building className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.ukupna_vrijednost_portfelja?.toLocaleString()} €</div>
            <p className="text-xs text-white/80">
              Ukupna tržišna vrijednost
            </p>
          </CardContent>
        </Card>

        <Card data-testid="godisnji-prinos-card" className="border-0 bg-gradient-to-r from-accent to-primary text-white shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">Godišnji prinos</CardTitle>
            <DollarSign className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.godisnji_prinos?.toLocaleString()} €</div>
            <p className="text-xs text-white/80">
              {dashboard.prinos_postotak}% ROI
            </p>
          </CardContent>
        </Card>
      </div>

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

// Nekretnine Component
const Nekretnine = () => {
  const [nekretnine, setNekretnine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNekretnina, setEditingNekretnina] = useState(null);
  const [selectedNekretnina, setSelectedNekretnina] = useState(null);
  const { dokumenti, ugovori, zakupnici, refresh: refreshEntities } = useEntityStore();
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

  const handleCreateNekretnina = async (formData) => {
    try {
      await api.createNekretnina(formData);
      toast.success('Nekretnina je uspješno kreirana');
      fetchNekretnine();
      await refreshEntities();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju nekretnine:', error);
      toast.error('Greška pri kreiranju nekretnine');
    }
  };

  const handleUpdateNekretnina = async (formData) => {
    try {
      await api.updateNekretnina(editingNekretnina.id, formData);
      toast.success('Nekretnina je uspješno ažurirana');
      fetchNekretnine();
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
      const neto = parseNumericValue(nekretnina.neto_prihod);
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
    const neto = parseNumericValue(nekretnina.neto_prihod);
    const osnova = parseNumericValue(nekretnina.nabavna_cijena) || parseNumericValue(nekretnina.trzisna_vrijednost);
    if (neto === null || osnova === null || osnova === 0) {
      return null;
    }
    return (neto / osnova) * 100;
  };

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {nekretnine.map((nekretnina) => {
          const propertyDocuments = documentsByProperty[nekretnina.id] || [];
          const propertyContracts = contractsByProperty[nekretnina.id] || [];
          const activeContracts = propertyContracts.filter((ugovor) => ugovor.status === 'aktivno');
          const expiringContracts = propertyContracts.filter((ugovor) => ugovor.status === 'na_isteku');
          const occupancy = propertyContracts.length ? (activeContracts.length / propertyContracts.length) * 100 : null;
          const roi = computeRoi(nekretnina);
          const riskBadges = getRiskBadges(nekretnina);
          const activeSummary = propertyContracts.length ? `${activeContracts.length}/${propertyContracts.length}` : '0';

          return (
            <Card key={nekretnina.id} data-testid={`nekretnina-card-${nekretnina.id}`} className="card-hover border border-border/60 shadow-shell">
              <CardHeader className="border-b border-border/60 bg-primary/5">
                <div className="flex items-start justify-between gap-4">
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
                  <div className="flex flex-wrap gap-2">
                    {riskBadges.map((badge) => (
                      <Badge key={badge.label} variant={badge.variant} className="rounded-full uppercase text-[11px]">
                        {badge.label}
                      </Badge>
                    ))}
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <InfoField label="Neto prihod" value={formatCurrency(nekretnina.neto_prihod)} />
                  <InfoField label="Tržišna vrijednost" value={formatCurrency(nekretnina.trzisna_vrijednost)} />
                  <InfoField label="Aktivni ugovori" value={activeSummary} />
                  <InfoField label="Popunjenost" value={occupancy !== null ? formatPercentage(occupancy) : '—'} />
                  <InfoField label="Ugovori na isteku" value={expiringContracts.length || '0'} />
                  <InfoField label="Dokumenti" value={propertyDocuments.length || '0'} />
                  <InfoField label="ROI (neto / investicija)" value={roi !== null ? formatPercentage(roi) : '—'} />
                  <InfoField label="Zadnja obnova" value={formatDate(nekretnina.zadnja_obnova)} />
                </div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/nekretnine/${nekretnina.id}/timeline`)}
                  >
                    Timeline
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
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
                <TabsTrigger value="overview">Pregled</TabsTrigger>
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

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedNekretnina(null);
                    navigate(`/nekretnine/${selectedNekretnina.id}/timeline`);
                  }}
                >
                  Otvori timeline aktivnosti
                </Button>
              </TabsContent>

              <TabsContent value="financije" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Financijski pregled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Tržišna vrijednost" value={formatCurrency(selectedNekretnina.trzisna_vrijednost)} />
                      <InfoField label="Nabavna cijena" value={formatCurrency(selectedNekretnina.nabavna_cijena)} />
                      <InfoField label="Prihodi prošle godine" value={formatCurrency(selectedNekretnina.prosllogodisnji_prihodi)} />
                      <InfoField label="Rashodi prošle godine" value={formatCurrency(selectedNekretnina.prosllogodisnji_rashodi)} />
                      <InfoField label="Amortizacija" value={formatCurrency(selectedNekretnina.amortizacija)} />
                      <InfoField label="Neto prihod" value={formatCurrency(selectedNekretnina.neto_prihod)} />
                      <InfoField label="Trošak održavanja" value={formatCurrency(selectedNekretnina.troskovi_odrzavanja)} />
                      <InfoField label="ROI" value={(() => {
                        const roiValue = computeRoi(selectedNekretnina);
                        return roiValue !== null ? formatPercentage(roiValue) : '—';
                      })()} />
                    </div>
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
                              <Badge variant="outline">Verzija {doc.verzija || '1.0'}</Badge>
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
                      <InfoField label="Napomene" value={selectedNekretnina.napomene || '—'} />
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
            onSubmit={handleUpdateNekretnina}
            onCancel={() => setEditingNekretnina(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Nekretnina Form Component
const NekretninarForm = ({ nekretnina, onSubmit, onCancel }) => {
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
    neto_prihod: nekretnina?.neto_prihod || '',
    zadnja_obnova: nekretnina?.zadnja_obnova || '',
    potrebna_ulaganja: nekretnina?.potrebna_ulaganja || '',
    troskovi_odrzavanja: nekretnina?.troskovi_odrzavanja || '',
    osiguranje: nekretnina?.osiguranje || '',
    sudski_sporovi: nekretnina?.sudski_sporovi || '',
    hipoteke: nekretnina?.hipoteke || '',
    napomene: nekretnina?.napomene || ''
  });

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
      neto_prihod: formData.neto_prihod ? parseFloat(formData.neto_prihod) : null,
      troskovi_odrzavanja: formData.troskovi_odrzavanja ? parseFloat(formData.troskovi_odrzavanja) : null,
      zadnja_obnova: formData.zadnja_obnova || null
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="nekretnina-form">
      <Tabs defaultValue="osnovni" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
          <TabsTrigger value="financije">Financije</TabsTrigger>
          <TabsTrigger value="odrzavanje">Održavanje</TabsTrigger>
          <TabsTrigger value="rizici">Rizici</TabsTrigger>
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
              <Label htmlFor="neto_prihod">Neto prihod (€)</Label>
              <Input
                id="neto_prihod"
                type="number"
                step="0.01"
                value={formData.neto_prihod}
                onChange={(e) => setFormData({ ...formData, neto_prihod: e.target.value })}
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
  const [zakupnici, setZakupnici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingZakupnik, setEditingZakupnik] = useState(null);
  const { refresh: refreshEntities } = useEntityStore();

  useEffect(() => {
    fetchZakupnici();
  }, []);

  const fetchZakupnici = async () => {
    try {
      const response = await api.getZakupnici();
      setZakupnici(response.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju zakupnika:', error);
      toast.error('Greška pri učitavanju zakupnika');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZakupnik = async (formData) => {
    try {
      await api.createZakupnik(formData);
      toast.success('Zakupnik je uspješno kreiran');
      fetchZakupnici();
      await refreshEntities();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju zakupnika:', error);
      toast.error('Greška pri kreiranju zakupnika');
    }
  };

  const handleUpdateZakupnik = async (formData) => {
    if (!editingZakupnik) return;
    try {
      await api.updateZakupnik(editingZakupnik.id, formData);
      toast.success('Zakupnik je uspješno ažuriran');
      fetchZakupnici();
      await refreshEntities();
      setEditingZakupnik(null);
    } catch (error) {
      console.error('Greška pri ažuriranju zakupnika:', error);
      toast.error('Greška pri ažuriranju zakupnika');
    }
  };

  if (loading) {
    return <div className="px-6 py-10">Učitava zakupnike...</div>;
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
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="dodaj-zakupnika-btn"
          className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2">Dodaj zakupnika</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {zakupnici.map((zakupnik) => (
          <Card key={zakupnik.id} data-testid={`zakupnik-card-${zakupnik.id}`} className="card-hover shadow-shell">
            <CardHeader className="border-b border-border/40 bg-primary/5">
              <CardTitle className="text-lg font-semibold text-foreground">{zakupnik.naziv_firme || zakupnik.ime_prezime}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-primary">OIB:</span> {zakupnik.oib}
              </p>
              <p>
                <span className="font-semibold text-primary">Sjedište:</span> {zakupnik.sjediste}
              </p>
              <p>
                <span className="font-semibold text-primary">Kontakt:</span> {zakupnik.kontakt_ime}
              </p>
              <p>
                <span className="font-semibold text-primary">Email:</span> {zakupnik.kontakt_email}
              </p>
              <p>
                <span className="font-semibold text-primary">Telefon:</span> {zakupnik.kontakt_telefon}
              </p>
              {zakupnik.iban && (
                <p>
                  <span className="font-semibold text-primary">IBAN:</span> {zakupnik.iban}
                </p>
              )}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingZakupnik(zakupnik)}
                  data-testid={`uredi-zakupnika-${zakupnik.id}`}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Uredi
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Zakupnik Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent aria-describedby="zakupnik-form-description">
          <DialogHeader>
            <DialogTitle>Dodaj novog zakupnika</DialogTitle>
          </DialogHeader>
          <div id="zakupnik-form-description" className="sr-only">
            Forma za kreiranje novog zakupnika s osnovnim informacijama
          </div>
          <ZakupnikForm 
            onSubmit={handleCreateZakupnik}
            onCancel={() => setShowCreateForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Zakupnik Dialog */}
      <Dialog open={!!editingZakupnik} onOpenChange={() => setEditingZakupnik(null)}>
        <DialogContent aria-describedby="uredi-zakupnik-form-description">
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
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Zakupnik Form Component
const ZakupnikForm = ({ zakupnik, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    naziv_firme: zakupnik?.naziv_firme || '',
    ime_prezime: zakupnik?.ime_prezime || '',
    oib: zakupnik?.oib || '',
    sjediste: zakupnik?.sjediste || '',
    kontakt_ime: zakupnik?.kontakt_ime || '',
    kontakt_email: zakupnik?.kontakt_email || '',
    kontakt_telefon: zakupnik?.kontakt_telefon || '',
    iban: zakupnik?.iban || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      naziv_firme: formData.naziv_firme || null,
      ime_prezime: formData.ime_prezime || null,
      iban: formData.iban || null
    };
    onSubmit(data);
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

      <div className="flex space-x-2">
        <Button type="submit" data-testid="potvrdi-zakupnik-form">
          Kreiraj zakupnika
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
  const [ugovori, setUgovori] = useState([]);
  const [nekretnine, setNekretnine] = useState([]);
  const [zakupnici, setZakupnici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('aktivno');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [contractToCopy, setContractToCopy] = useState(null);
  const [renewalTemplate, setRenewalTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const { dokumenti, refresh: refreshEntities } = useEntityStore();
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

  useEffect(() => {
    fetchData();
    
    // Provjeri je li došao renewal request
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

  const fetchData = async () => {
    try {
      const [ugovoriRes, nekretnineRes, zakupniciRes] = await Promise.all([
        api.getUgovori(),
        api.getNekretnine(),
        api.getZakupnici()
      ]);
      setUgovori(ugovoriRes.data);
      setNekretnine(nekretnineRes.data);
      setZakupnici(zakupniciRes.data);
    } catch (error) {
      console.error('Greška pri dohvaćanju podataka:', error);
      toast.error('Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUgovor = async (formData) => {
    try {
      await api.createUgovor(formData);
      toast.success('Ugovor je uspješno kreiran');
      fetchData();
      await refreshEntities();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Greška pri kreiranju ugovora:', error);
      toast.error('Greška pri kreiranju ugovora');
    }
  };

  const handleStatusChange = async (ugovorId, noviStatus) => {
    try {
      await api.updateStatusUgovora(ugovorId, noviStatus);
      toast.success('Status ugovora je ažuriran');
      fetchData();
      await refreshEntities();
    } catch (error) {
      console.error('Greška pri ažuriranju statusa:', error);
      toast.error('Greška pri ažuriranju statusa');
    }
  };

  const getNekretnina = (nekretnina_id) => {
    return nekretnine.find(n => n.id === nekretnina_id);
  };

  const getZakupnik = (zakupnik_id) => {
    return zakupnici.find(z => z.id === zakupnik_id);
  };

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

  const handleCopyContract = (ugovor) => {
    setContractToCopy(ugovor);
    setShowCopyDialog(true);
  };

  const handleDownloadContractDocument = (dokument) => {
    if (!dokument.putanja_datoteke) {
      toast.error('PDF nije dostupan za ovaj dokument');
      return;
    }
    const url = `${BACKEND_URL}/${dokument.putanja_datoteke}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleCreateCopiedContract = async (godina) => {
    try {
      if (!contractToCopy) return;
      
      const noviDatumPocetka = new Date();
      const noviDatumZavrsetka = new Date();
      noviDatumZavrsetka.setFullYear(noviDatumZavrsetka.getFullYear() + godina);
      
      const noviUgovor = {
        interna_oznaka: `${contractToCopy.interna_oznaka}-COPY-${godina}G-${Date.now()}`,
        nekretnina_id: contractToCopy.nekretnina_id,
        zakupnik_id: contractToCopy.zakupnik_id,
        datum_potpisivanja: new Date().toISOString().split('T')[0],
        datum_pocetka: noviDatumPocetka.toISOString().split('T')[0],
        datum_zavrsetka: noviDatumZavrsetka.toISOString().split('T')[0],
        trajanje_mjeseci: godina * 12,
        opcija_produljenja: contractToCopy.opcija_produljenja,
        uvjeti_produljenja: contractToCopy.uvjeti_produljenja,
        rok_otkaza_dani: contractToCopy.rok_otkaza_dani,
        osnovna_zakupnina: contractToCopy.osnovna_zakupnina,
        zakupnina_po_m2: contractToCopy.zakupnina_po_m2,
        cam_troskovi: contractToCopy.cam_troskovi,
        polog_depozit: contractToCopy.polog_depozit,
        garancija: contractToCopy.garancija,
        indeksacija: contractToCopy.indeksacija,
        indeks: contractToCopy.indeks,
        formula_indeksacije: contractToCopy.formula_indeksacije,
        obveze_odrzavanja: contractToCopy.obveze_odrzavanja,
        namjena_prostora: contractToCopy.namjena_prostora,
        rezije_brojila: contractToCopy.rezije_brojila
      };

      await api.createUgovor(noviUgovor);
      toast.success(`Novi ugovor na ${godina} ${godina === 1 ? 'godinu' : 'godina'} je uspješno kreiran na osnovu postojećeg!`);
      setShowCopyDialog(false);
      setContractToCopy(null);
      fetchData();
      await refreshEntities();
    } catch (error) {
      console.error('Greška pri kreiranju kopije ugovora:', error);
      toast.error('Greška pri kreiranju kopije ugovora');
    }
  };

  const generateContractPDF = async (ugovor) => {
    try {
      toast.info('Generiranje PDF ugovora...');
      
      const nekretnina = getNekretnina(ugovor.nekretnina_id);
      const zakupnik = getZakupnik(ugovor.zakupnik_id);
      
      // Kreiraj novi PDF dokument
      const doc = new jsPDF();
      
      // Zaglavlje
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('UGOVOR O ZAKUPU', 105, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Broj: ${ugovor.interna_oznaka}`, 105, 30, { align: 'center' });
      
      // Linija
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      let yPos = 50;
      
      // Ugovorne strane
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('UGOVORNE STRANE:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text('ZAKUPODAVAC:', 20, yPos);
      yPos += 6;
      doc.text(nekretnina?.vlasnik || 'Vlasnik nekretnine', 30, yPos);
      yPos += 10;
      
      doc.text('ZAKUPNIK:', 20, yPos);
      yPos += 6;
      doc.text(zakupnik?.naziv_firme || zakupnik?.ime_prezime || 'Zakupnik', 30, yPos);
      yPos += 6;
      doc.text(`OIB: ${zakupnik?.oib}`, 30, yPos);
      yPos += 6;
      doc.text(`Adresa: ${zakupnik?.sjediste}`, 30, yPos);
      yPos += 15;
      
      // Predmet ugovora
      doc.setFont('helvetica', 'bold');
      doc.text('PREDMET UGOVORA:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Nekretnina: ${nekretnina?.naziv}`, 20, yPos);
      yPos += 6;
      doc.text(`Adresa: ${nekretnina?.adresa}`, 20, yPos);
      yPos += 6;
      doc.text(`Katastarska općina: ${nekretnina?.katastarska_opcina}`, 20, yPos);
      yPos += 6;
      doc.text(`Broj kat. čestice: ${nekretnina?.broj_kat_cestice}`, 20, yPos);
      yPos += 6;
      doc.text(`Površina: ${nekretnina?.povrsina} m²`, 20, yPos);
      yPos += 6;
      doc.text(`Namjena: ${ugovor.namjena_prostora || 'Nisu specificirane'}`, 20, yPos);
      yPos += 15;
      
      // Vrijeme trajanja
      doc.setFont('helvetica', 'bold');
      doc.text('VRIJEME TRAJANJA:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Početak zakupa: ${new Date(ugovor.datum_pocetka).toLocaleDateString()}`, 20, yPos);
      yPos += 6;
      doc.text(`Završetak zakupa: ${new Date(ugovor.datum_zavrsetka).toLocaleDateString()}`, 20, yPos);
      yPos += 6;
      doc.text(`Trajanje: ${ugovor.trajanje_mjeseci} mjeseci`, 20, yPos);
      yPos += 6;
      doc.text(`Rok otkaza: ${ugovor.rok_otkaza_dani} dana`, 20, yPos);
      yPos += 15;
      
      // Financijske odredbe
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIJSKE ODREDBE:', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Mjesečna zakupnina: ${ugovor.osnovna_zakupnina.toLocaleString()} EUR`, 20, yPos);
      yPos += 6;
      
      if (ugovor.zakupnina_po_m2) {
        doc.text(`Zakupnina po m²: ${ugovor.zakupnina_po_m2.toLocaleString()} EUR/m²`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.cam_troskovi) {
        doc.text(`CAM troškovi: ${ugovor.cam_troskovi.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.polog_depozit) {
        doc.text(`Polog/depozit: ${ugovor.polog_depozit.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.garancija) {
        doc.text(`Garancija: ${ugovor.garancija.toLocaleString()} EUR`, 20, yPos);
        yPos += 6;
      }
      
      if (ugovor.indeksacija) {
        doc.text(`Indeksacija: DA (${ugovor.indeks}, ${ugovor.formula_indeksacije})`, 20, yPos);
        yPos += 6;
      }
      
      yPos += 10;
      
      // Obveze održavanja
      if (ugovor.obveze_odrzavanja) {
        doc.setFont('helvetica', 'bold');
        doc.text('OBVEZE ODRŽAVANJA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Odgovorno: ${ugovor.obveze_odrzavanja}`, 20, yPos);
        yPos += 15;
      }
      
      // Režije
      if (ugovor.rezije_brojila) {
        doc.setFont('helvetica', 'bold');
        doc.text('REŽIJE I BROJILA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        const rezije = doc.splitTextToSize(ugovor.rezije_brojila, 170);
        doc.text(rezije, 20, yPos);
        yPos += rezije.length * 6 + 10;
      }
      
      // Opcija produljenja
      if (ugovor.opcija_produljenja) {
        doc.setFont('helvetica', 'bold');
        doc.text('OPCIJA PRODULJENJA:', 20, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text('DA', 20, yPos);
        if (ugovor.uvjeti_produljenja) {
          yPos += 6;
          const uvjeti = doc.splitTextToSize(`Uvjeti: ${ugovor.uvjeti_produljenja}`, 170);
          doc.text(uvjeti, 20, yPos);
          yPos += uvjeti.length * 6;
        }
        yPos += 10;
      }
      
      // Potpisi
      yPos = Math.max(yPos, 240);
      doc.setFont('helvetica', 'bold');
      doc.text('POTPISI:', 20, yPos);
      yPos += 15;
      
      doc.setFont('helvetica', 'normal');
      doc.text('Zakupodavac:', 20, yPos);
      doc.text('Zakupnik:', 120, yPos);
      yPos += 20;
      
      doc.text('_____________________', 20, yPos);
      doc.text('_____________________', 120, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.text(`Zagreb, ${new Date(ugovor.datum_potpisivanja).toLocaleDateString()}`, 20, yPos);
      
      // Datum generiranja
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Ugovor generiran: ${new Date().toLocaleString()}`, 20, 285);
      
      // Spremi PDF
      const fileName = `Ugovor_${ugovor.interna_oznaka.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success(`PDF ugovor ${ugovor.interna_oznaka} je uspješno generiran za potpis!`);
    } catch (error) {
      console.error('Greška pri generiranju PDF ugovora:', error);
      toast.error('Greška pri generiranju PDF ugovora');
    }
  };

  const archivedStatuses = ARCHIVED_CONTRACT_STATUSES;
  const activeContractsCount = useMemo(() => ugovori.filter((u) => u.status === 'aktivno').length, [ugovori]);
  const archivedContractsCount = useMemo(() => ugovori.filter((u) => archivedStatuses.has(u.status)).length, [ugovori]);
  const expiringContractsCount = useMemo(() => ugovori.filter((u) => u.status === 'aktivno' && isUgovorNaIsteku(u)).length, [ugovori]);

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

  return (
    <div className="p-8 space-y-6">
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
            onClick={() => setShowCreateForm(true)}
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
                        <li key={dokument.id} className="flex items-center justify-between">
                          <span className="truncate mr-2" title={dokument.naziv}>
                            {dokument.naziv}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadContractDocument(dokument)}
                            disabled={!dokument.putanja_datoteke}
                            data-testid={`ugovor-doc-download-${dokument.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
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
                <div className="flex items-center space-x-2 pt-2">
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
                  
                  {ugovor.opcija_produljenja && (
                    <Badge variant="outline" className="rounded-full text-[11px] uppercase tracking-wide text-primary">
                      Opcija produljenja
                    </Badge>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyContract(ugovor)}
                    data-testid={`copy-contract-${ugovor.id}`}
                    className="ml-2"
                  >
                    📋 Kopiraj
                  </Button>
                  
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => generateContractPDF(ugovor)}
                    data-testid={`generate-pdf-${ugovor.id}`}
                    className="ml-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    📄 PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Contract Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="ugovor-form-description">
          <DialogHeader>
            <DialogTitle>
              {renewalTemplate ? 'Produžetak ugovora - Nova interna oznaka' : 'Dodaj novi ugovor'}
            </DialogTitle>
          </DialogHeader>
          <div id="ugovor-form-description" className="sr-only">
            Forma za kreiranje novog ugovora o zakupu
          </div>
          <UgovorForm 
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            onSubmit={handleCreateUgovor}
            onCancel={() => {
              setShowCreateForm(false);
              setRenewalTemplate(null);
            }}
            renewalTemplate={renewalTemplate}
          />
        </DialogContent>
      </Dialog>

      {/* Copy Contract Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="copy-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Kreiraj novi ugovor na osnovu postojećeg
            </DialogTitle>
          </DialogHeader>
          <div id="copy-dialog-description" className="sr-only">
            Dialog za kreiranje novog ugovora na osnovu postojećeg s opcijama 1, 2 ili 5 godina
          </div>

          {contractToCopy && (
            <div className="space-y-6">
              {/* Original contract details */}
              <div className="rounded-2xl border border-border/60 bg-primary/5 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kopira se ugovor</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-foreground/90">
                  <div>
                    <span className="font-semibold text-primary">Oznaka:</span> {contractToCopy.interna_oznaka}
                  </div>
                  <div>
                    <span className="font-semibold text-primary">Kirija:</span> {contractToCopy.osnovna_zakupnina?.toLocaleString()} €
                  </div>
                  <div>
                    <span className="font-semibold text-primary">Početak:</span> {new Date(contractToCopy.datum_pocetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-semibold text-primary">Završetak:</span> {new Date(contractToCopy.datum_zavrsetka).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Copy options */}
              <div>
                <h3 className="font-medium mb-4">Odaberite trajanje novog ugovora:</h3>
                <div className="grid grid-cols-1 gap-3">
                  
                  <Card 
                    className="cursor-pointer border border-border/60 transition-all hover:border-primary/60 hover:bg-primary/10"
                    onClick={() => handleCreateCopiedContract(1)}
                    data-testid="copy-option-1-year"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">1 Godina</h4>
                          <p className="text-sm text-muted-foreground">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-muted-foreground/80">Početak: danas, završetak: za godinu dana</p>
                        </div>
                        <Badge variant="default" className="rounded-full bg-primary text-primary-foreground">Kratko</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer border border-accent/60 transition-all hover:border-accent hover:bg-accent/15"
                    onClick={() => handleCreateCopiedContract(2)}
                    data-testid="copy-option-2-years"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">2 Godine</h4>
                          <p className="text-sm text-muted-foreground">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-muted-foreground/80">Početak: danas, završetak: za 2 godine</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full border-none bg-accent text-primary-foreground">Preporučeno</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="cursor-pointer border border-border/60 transition-all hover:border-primary/60 hover:bg-primary/10"
                    onClick={() => handleCreateCopiedContract(5)}
                    data-testid="copy-option-5-years"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-lg">5 Godina</h4>
                          <p className="text-sm text-muted-foreground">
                            Ista kirija: {contractToCopy.osnovna_zakupnina?.toLocaleString()} €/mjesec
                          </p>
                          <p className="text-xs text-muted-foreground/80">Početak: danas, završetak: za 5 godina</p>
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
                  onClick={() => setShowCopyDialog(false)}
                  className="flex-1"
                  data-testid="cancel-copy"
                >
                  Otkaži
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Ugovor Form Component
const UgovorForm = ({ nekretnine, zakupnici, onSubmit, onCancel, renewalTemplate }) => {
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
    opcija_produljenja: false,
    uvjeti_produljenja: '',
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
    rezije_brojila: ''
  });

  useEffect(() => {
    if (renewalTemplate) {
      setFormData({
        interna_oznaka: renewalTemplate.interna_oznaka,
        nekretnina_id: renewalTemplate.nekretnina_id,
        zakupnik_id: renewalTemplate.zakupnik_id,
        datum_potpisivanja: renewalTemplate.datum_potpisivanja,
        datum_pocetka: renewalTemplate.datum_pocetka,
        datum_zavrsetka: renewalTemplate.datum_zavrsetka,
        trajanje_mjeseci: renewalTemplate.trajanje_mjeseci.toString(),
        opcija_produljenja: renewalTemplate.opcija_produljenja,
        uvjeti_produljenja: renewalTemplate.uvjeti_produljenja || '',
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
  }, [renewalTemplate]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Molimo odaberite PDF datoteku');
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);

    try {
      toast.info('Analiziram PDF ugovor...');
      const response = await api.parsePdfContract(file);
      
      if (!response.data.success) {
        toast.error(response.data.message || 'Greška pri analizi PDF-a');
        return;
      }
      
      const parsedData = response.data.data;

      // Popuni formu s podacima iz PDF-a
      const ugovor = parsedData.ugovor || {};
      const financije = parsedData.financije || {};
      const ostalo = parsedData.ostalo || {};
      
      setFormData(prevData => ({
        ...prevData,
        // Osnovni podaci ugovora
        interna_oznaka: ugovor.interna_oznaka || prevData.interna_oznaka,
        datum_potpisivanja: ugovor.datum_potpisivanja || prevData.datum_potpisivanja,
        datum_pocetka: ugovor.datum_pocetka || prevData.datum_pocetka,
        datum_zavrsetka: ugovor.datum_zavrsetka || prevData.datum_zavrsetka,
        trajanje_mjeseci: ugovor.trajanje_mjeseci?.toString() || prevData.trajanje_mjeseci,
        rok_otkaza_dani: ugovor.rok_otkaza_dani || prevData.rok_otkaza_dani,
        opcija_produljenja: ugovor.opcija_produljenja !== null ? ugovor.opcija_produljenja : prevData.opcija_produljenja,
        uvjeti_produljenja: ugovor.uvjeti_produljenja || prevData.uvjeti_produljenja,
        
        // Financijski podaci
        osnovna_zakupnina: financije.osnovna_zakupnina?.toString() || prevData.osnovna_zakupnina,
        zakupnina_po_m2: financije.zakupnina_po_m2?.toString() || prevData.zakupnina_po_m2,
        cam_troskovi: financije.cam_troskovi?.toString() || prevData.cam_troskovi,
        polog_depozit: financije.polog_depozit?.toString() || prevData.polog_depozit,
        garancija: financije.garancija?.toString() || prevData.garancija,
        indeksacija: financije.indeksacija !== null ? financije.indeksacija : prevData.indeksacija,
        indeks: financije.indeks || prevData.indeks,
        formula_indeksacije: financije.formula_indeksacije || prevData.formula_indeksacije,
        
        // Ostali podaci
        obveze_odrzavanja: ostalo.obveze_odrzavanja || prevData.obveze_odrzavanja,
        namjena_prostora: parsedData.nekretnina?.namjena_prostora || prevData.namjena_prostora,
        rezije_brojila: ostalo.rezije_brojila || prevData.rezije_brojila
      }));

      toast.success('PDF ugovor je uspješno analiziran i podaci su uneseni u formu!');
    } catch (error) {
      console.error('Greška pri analizi PDF-a:', error);
      toast.error('Greška pri analizi PDF ugovora. Molimo unesite podatke ručno.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    document.getElementById('pdf-upload').value = '';
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
      garancija: formData.garancija ? parseFloat(formData.garancija) : null
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
            onChange={(value) => setFormData({ ...formData, nekretnina_id: value })}
            renderLabel={(nekretnina) => `${nekretnina.naziv} - ${nekretnina.adresa}`}
            testId="ugovor-nekretnina-select"
            allowNone={false}
          />

          <LinkedEntitySelect
            label="Zakupnik *"
            placeholder="Izaberite zakupnika"
            entities={zakupnici}
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
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="opcija_produljenja"
                checked={formData.opcija_produljenja}
                onChange={(e) => setFormData({ ...formData, opcija_produljenja: e.target.checked })}
                data-testid="ugovor-produljenje-checkbox"
              />
              <Label htmlFor="opcija_produljenja">Opcija produljenja</Label>
            </div>
          </div>

          {formData.opcija_produljenja && (
            <div>
              <Label htmlFor="uvjeti_produljenja">Uvjeti produljenja</Label>
              <Textarea
                id="uvjeti_produljenja"
                value={formData.uvjeti_produljenja}
                onChange={(e) => setFormData({ ...formData, uvjeti_produljenja: e.target.value })}
                data-testid="ugovor-uvjeti-input"
              />
            </div>
          )}

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
  ostalo: 'Ostalo',
};

const formatDocumentType = (tip) => DOCUMENT_TYPE_LABELS[tip] || tip;

const Dokumenti = () => {
  const { dokumenti, nekretnine, zakupnici, ugovori, loading: storeLoading, refresh } = useEntityStore();
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
  }, [nekretnine, zakupnici, ugovori]);

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
          dokument.uploadao.toLowerCase().includes(query) ||
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

  const getDocumentUrl = useCallback((dokument) => {
    if (!dokument || !dokument.putanja_datoteke) {
      return null;
    }
    return `${BACKEND_URL}/${dokument.putanja_datoteke}`;
  }, []);

  const DocumentViewer = ({ dokument }) => {
    if (!dokument || !dokument.putanja_datoteke) {
      return (
        <div className="flex h-[65vh] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 text-sm text-muted-foreground/80">
          PDF nije dostupan. Preuzmite datoteku putem opcije ispod.
        </div>
      );
    }

    const viewerUrl = `${BACKEND_URL}/${dokument.putanja_datoteke}#toolbar=0&view=FitH`;

    return (
      <div className="h-[70vh] overflow-hidden rounded-xl border border-border/60 bg-white shadow-inner">
        <object data={viewerUrl} type="application/pdf" className="h-full w-full">
          <iframe
            src={viewerUrl}
            title={`Pregled: ${dokument.naziv}`}
            className="h-full w-full"
            loading="lazy"
          />
          <div className="p-6 text-sm text-muted-foreground/80">
            Pregled nije podržan u ovom pregledniku. Koristite gumb za otvaranje u novom prozoru.
          </div>
        </object>
      </div>
    );
  };

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
                  <span className="font-medium">Verzija:</span> {dokument.verzija}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Uploadao:</span> {dokument.uploadao}
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
            onSubmit={handleCreateDokument}
            onCancel={() => setShowCreateForm(false)}
            refreshEntities={refresh}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]" aria-describedby="document-preview-description">
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
                  <div><span className="font-medium">Verzija:</span> {previewDocument.verzija}</div>
                  <div><span className="font-medium">Uploadao:</span> {previewDocument.uploadao}</div>
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
                <DocumentViewer dokument={previewDocument} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground/80">
                    Datoteka: {previewDocument.putanja_datoteke || 'Nije prenesena'}
                    {previewDocument.velicina_datoteke > 0 && (
                      <> • Veličina: {(previewDocument.velicina_datoteke / 1024).toFixed(1)} KB</>
                    )}
                  </div>
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


const LinkedEntitySelect = ({ label, placeholder, entities, value, onChange, renderLabel, testId, allowNone = true }) => {
  const selectValue = allowNone ? (value || emptySelectValue) : (value || undefined);
  const handleChange = (selected) => {
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
        <SelectTrigger data-testid={testId}>
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

const DokumentForm = ({ nekretnine, zakupnici, ugovori, onSubmit, onCancel, refreshEntities, loading }) => {
  const fileInputRef = useRef(null);
  const initialFormState = {
    naziv: '',
    tip: 'ugovor',
    opis: '',
    verzija: '1.0',
    nekretnina_id: '',
    zakupnik_id: '',
    ugovor_id: '',
    uploadao: '',
    file: null,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState({ property: false, tenant: false, contract: false });

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

  const findTenantMatch = useCallback((suggestion) => {
    if (!suggestion) return null;
    const name = normalize(suggestion.naziv_firme || suggestion.ime_prezime);
    const oib = normalize(suggestion.oib);
    return zakupnici.find((item) => {
      const itemName = normalize(item.naziv_firme || item.ime_prezime);
      const itemOib = normalize(item.oib);
      if (oib && itemOib === oib) return true;
      if (name && itemName === name) return true;
      if (name && itemName.includes(name)) return true;
      return false;
    }) || null;
  }, [zakupnici]);

  const findContractMatch = useCallback((suggestion) => {
    if (!suggestion) return null;
    const oznaka = normalize(suggestion.interna_oznaka);
    if (!oznaka) return null;
    return ugovori.find((item) => normalize(item.interna_oznaka) === oznaka) || null;
  }, [ugovori]);

  const matchedProperty = useMemo(() => findPropertyMatch(aiSuggestions?.nekretnina), [aiSuggestions, findPropertyMatch]);
  const matchedTenant = useMemo(() => findTenantMatch(aiSuggestions?.zakupnik), [aiSuggestions, findTenantMatch]);
  const matchedContract = useMemo(() => findContractMatch(aiSuggestions?.ugovor), [aiSuggestions, findContractMatch]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, file }));
    setAiSuggestions(null);
    setAiError(null);

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Molimo odaberite PDF datoteku');
      return;
    }

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

      setFormData((prev) => {
        const updated = {
          ...prev,
          tip: suggestions.document_type === 'racun' ? 'racun' : 'ugovor',
          naziv: prev.naziv || (contract.interna_oznaka ? `Ugovor ${contract.interna_oznaka}` : prev.naziv),
          opis: prev.opis || tenantSuggestion.naziv_firme || '',
          verzija: prev.verzija || '1.0',
        };

        const propertyMatch = findPropertyMatch(propertySuggestion);
        if (propertyMatch) {
          updated.nekretnina_id = propertyMatch.id;
        }

        const tenantMatch = findTenantMatch(tenantSuggestion);
        if (tenantMatch) {
          updated.zakupnik_id = tenantMatch.id;
        }

        const contractMatch = findContractMatch(contract);
        if (contractMatch) {
          updated.ugovor_id = contractMatch.id;
        }

        if (suggestions.document_type === 'racun' && aiSuggestions?.racun) {
          updated.tip = 'racun';
          updated.naziv = prev.naziv || aiSuggestions.racun.broj_racuna || 'Račun';
        }

        return updated;
      });
      toast.success('AI prijedlozi spremni – provjerite prijedloge ispod.');
    } catch (error) {
      console.error('AI analiza dokumenta nije uspjela:', error);
      const message = error.response?.data?.detail || 'Greška pri AI analizi dokumenta';
      setAiError(message);
      toast.error(message);
    } finally {
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
        neto_prihod: toNumberOrNull(suggestion.neto_prihod),
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

  const handleCreateTenantFromAI = async () => {
    if (!aiSuggestions?.zakupnik) return;
    setQuickCreateLoading((prev) => ({ ...prev, tenant: true }));
    const suggestion = aiSuggestions.zakupnik;
    try {
      const payload = {
        naziv_firme: suggestion.naziv_firme || null,
        ime_prezime: suggestion.ime_prezime || null,
        oib: suggestion.oib || `OIB-${Date.now()}`,
        sjediste: suggestion.sjediste || 'Nepoznata adresa',
        kontakt_ime: suggestion.kontakt_ime || (suggestion.ime_prezime || 'Kontakt osoba'),
        kontakt_email: suggestion.kontakt_email || 'kontakt@example.com',
        kontakt_telefon: suggestion.kontakt_telefon || '000-000-000',
        iban: suggestion.iban || null,
      };
      const response = await api.createZakupnik(payload);
      toast.success('Zakupnik je kreiran iz AI prijedloga');
      await refreshEntities();
      setFormData((prev) => ({ ...prev, zakupnik_id: response.data.id }));
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
        opcija_produljenja: contract.opcija_produljenja ?? false,
        uvjeti_produljenja: contract.uvjeti_produljenja || null,
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
    try {
      await onSubmit({
        ...formData,
        nekretnina_id: formData.nekretnina_id || null,
        zakupnik_id: formData.zakupnik_id || null,
        ugovor_id: formData.ugovor_id || null,
      });
      setFormData({ ...initialFormState });
      setAiSuggestions(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Greška pri spremanju dokumenta:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="dokument-form">
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
          <Select value={formData.tip} onValueChange={(value) => setFormData({ ...formData, tip: value })}>
            <SelectTrigger data-testid="dokument-tip-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ugovor">Ugovor</SelectItem>
              <SelectItem value="racun">Račun</SelectItem>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="verzija">Verzija</Label>
          <Input
            id="verzija"
            value={formData.verzija}
            onChange={(e) => setFormData({ ...formData, verzija: e.target.value })}
            data-testid="dokument-verzija-input"
          />
        </div>
        <div>
          <Label htmlFor="uploadao">Uploadao *</Label>
          <Input
            id="uploadao"
            value={formData.uploadao}
            onChange={(e) => setFormData({ ...formData, uploadao: e.target.value })}
            data-testid="dokument-uploadao-input"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="file">PDF dokument (opcionalno)</Label>
        <Input
          id="file"
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          data-testid="dokument-file-input"
        />
        <p className="text-xs text-muted-foreground/80 mt-1">PDF će biti analiziran kako bi se automatski predložile informacije i poveznice.</p>
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
            ugovor_id: value ? prev.ugovor_id : '',
          }))}
          renderLabel={(nekretnina) => `${nekretnina.naziv} - ${nekretnina.adresa}`}
          testId="dokument-nekretnina-select"
        />
        <LinkedEntitySelect
          label="Zakupnik"
          placeholder="Nema veze sa zakupnikom"
          entities={zakupnici}
          value={formData.zakupnik_id}
          onChange={(value) => setFormData((prev) => ({
            ...prev,
            zakupnik_id: value,
            ugovor_id: value ? prev.ugovor_id : '',
          }))}
          renderLabel={(zakupnik) => `${zakupnik.naziv_firme || zakupnik.ime_prezime} - ${zakupnik.oib}`}
          testId="dokument-zakupnik-select"
        />
        <LinkedEntitySelect
          label="Ugovor"
          placeholder="Nema veze s ugovorom"
          entities={ugovori}
          value={formData.ugovor_id}
          onChange={(value) => setFormData({ ...formData, ugovor_id: value })}
          renderLabel={(ugovor) => ugovor.interna_oznaka}
          testId="dokument-ugovor-select"
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

// Property Timeline Component
const PropertyTimeline = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { nekretnine, ugovori, dokumenti } = useEntityStore();
  const [podsjetnici, setPodsjetnici] = useState([]);
  const property = nekretnine.find((item) => item.id === id);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getPodsjetnici();
        setPodsjetnici(response.data || []);
      } catch (error) {
        console.error('Greška pri dohvaćanju podsjetnika za timeline:', error);
      }
    };
    load();
  }, []);

  if (!property) {
    return (
      <div className="p-8 space-y-4">
        <Button variant="outline" onClick={() => navigate('/nekretnine')}>&larr; Povratak na popis</Button>
        <p>Nekretnina nije pronađena.</p>
      </div>
    );
  }

  const contractById = Object.fromEntries(ugovori.map((ugovor) => [ugovor.id, ugovor]));

  const events = [];

  dokumenti
    .filter((doc) => doc.nekretnina_id === id)
    .forEach((doc) => {
      events.push({
        type: 'Dokument',
        title: doc.naziv,
        description: formatDocumentType(doc.tip),
        date: doc.kreiran,
        link: `/dokumenti?highlight=${doc.id}`,
      });
    });

  podsjetnici
    .filter((item) => {
      const contract = contractById[item.ugovor_id];
      return contract?.nekretnina_id === id;
    })
    .forEach((item) => {
      const contract = contractById[item.ugovor_id];
      events.push({
        type: 'Podsjetnik',
        title: item.tip,
        description: contract ? `Ugovor ${contract.interna_oznaka}` : 'Podsjetnik za ugovor',
        date: item.datum_podsjetnika,
        link: `/#podsjetnici`,
      });
    });

  events.sort((a, b) => {
    const aDate = a.date ? new Date(a.date).getTime() : 0;
    const bDate = b.date ? new Date(b.date).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Timeline: {property.naziv}</h1>
          <p className="text-sm text-muted-foreground/80">{property.adresa}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/nekretnine')}>&larr; Povratak</Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground/80">
            Nema evidentiranih aktivnosti za ovu nekretninu.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <Card key={index} className="border border-border/60">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1">{event.type}</Badge>
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="text-sm text-muted-foreground/80">{event.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{event.date ? new Date(event.date).toLocaleDateString() : 'Nepoznat datum'}</p>
                    {event.link && (
                      <Link to={event.link} className="text-xs text-blue-600 hover:underline">Detalji</Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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
            <Route path="/nekretnine/:id/timeline" element={<PropertyTimeline />} />
            <Route path="/zakupnici" element={<Zakupnici />} />
            <Route path="/ugovori" element={<Ugovori />} />
            <Route path="/dokumenti" element={<Dokumenti />} />
          </Routes>
        </BrowserRouter>
      </div>
    </EntityStoreProvider>
  );
}

export default App;
