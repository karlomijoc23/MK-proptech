import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
  useId,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import jsPDF from "jspdf";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { ScrollArea } from "./components/ui/scroll-area";
import { Checkbox } from "./components/ui/checkbox";
import { Switch } from "./components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import { Toaster, toast } from "./components/ui/sonner";
import {
  Home,
  Building,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Plus,
  Eye,
  Edit,
  Trash2,
  Search,
  Bell,
  Download,
  ArrowRight,
  Printer,
  Archive,
  ArchiveRestore,
  Wrench,
  Settings,
  Loader2,
  ChevronDown,
  Check,
  LogOut,
} from "lucide-react";
import logoMain from "./assets/riforma-logo.png";
import "./App.css";
import { api, BACKEND_URL, buildDocumentUrl } from "./shared/api";
import { AuthProvider, useAuth } from "./shared/auth";
import { canManageTenants } from "./shared/tenantAccess";
import {
  parseNumericValue,
  formatCurrency,
  formatArea,
  formatPercentage,
  formatDeltaPercentage,
  formatDate,
  formatDateTime,
  formatBooleanish,
  formatPropertyType,
} from "./shared/formatters";
import {
  DOCUMENT_TYPE_LABELS,
  PROPERTY_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPES,
  resolveDocumentType,
  formatDocumentType,
} from "./shared/documents";
import {
  EntityStoreProvider,
  useEntityStore,
  EntityStoreContext,
} from "./shared/entityStore";
import {
  UNIT_STATUS_CONFIG,
  getUnitStatusBadgeClass,
  getUnitStatusDotClass,
  formatUnitStatus,
  getUnitDisplayName,
  computeUnitsSummary,
  sortUnitsByPosition,
  convertUnitDraftToPayload,
  normaliseNekretninaPayload,
  resolveUnitTenantName,
} from "./shared/units";
import DocumentViewer from "./features/documents/components/DocumentViewer";
import { UnitStatusMap } from "./features/properties";
import TenantProfiles from "./features/tenants/TenantProfiles";
import LoginPage from "./features/auth/LoginPage";
import LinkedEntitySelect from "./components/LinkedEntitySelect";

const DocumentsPageLazy = React.lazy(
  () => import("./features/documents/DocumentsPage"),
);

const InfoField = ({ label, value, fallback = "—" }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
      {label}
    </p>
    <p className="text-sm font-medium text-foreground">{value ?? fallback}</p>
  </div>
);

const isContractExpiring = (ugovor, windowInDays = 90) => {
  if (!ugovor?.datum_zavrsetka) {
    return false;
  }
  const today = new Date();
  const endDate = new Date(ugovor.datum_zavrsetka);
  const diffInDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  return diffInDays > 0 && diffInDays <= windowInDays;
};

const ARCHIVED_CONTRACT_STATUSES = new Set(["arhivirano", "raskinuto"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatRoleLabel = (role) => {
  if (!role) {
    return "";
  }
  const mapping = {
    owner: "Vlasnik",
    admin: "Administrator",
    member: "Član",
    viewer: "Pregled",
    property_manager: "Property manager",
    leasing_agent: "Leasing agent",
    maintenance_coordinator: "Koordinator održavanja",
    accountant: "Financije",
    tenant: "Zakupnik",
    vendor: "Dobavljač",
  };
  return mapping[role] || role;
};

const useAuditTimeline = (
  entityType,
  entityId,
  { parentId, limit = 20, enabled = true } = {},
) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const shouldFetch = enabled && Boolean(entityType || entityId || parentId);

  const fetchLogs = useCallback(
    async (options = {}) => {
      if (!shouldFetch) {
        setLogs([]);
        setError(null);
        if (!options.silent) {
          setLoading(false);
        }
        return;
      }

      if (!options.silent) {
        setLoading(true);
      }

      try {
        const params = { limit };
        if (entityType) {
          params.entity_type = entityType;
        }
        if (entityId) {
          params.entity_id = entityId;
        }
        if (parentId) {
          params.parent_id = parentId;
        }
        const response = await api.getAuditLogs(params);
        setLogs(response.data || []);
        setError(null);
      } catch (err) {
        console.error("Greška pri dohvaćanju audit zapisa:", err);
        setError("Audit zapis nije moguće učitati");
        setLogs([]);
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [shouldFetch, entityType, entityId, parentId, limit],
  );

  useEffect(() => {
    let cancelled = false;

    if (!shouldFetch) {
      setLogs([]);
      setError(null);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const params = { limit };
        if (entityType) {
          params.entity_type = entityType;
        }
        if (entityId) {
          params.entity_id = entityId;
        }
        if (parentId) {
          params.parent_id = parentId;
        }
        const response = await api.getAuditLogs(params);
        if (!cancelled) {
          setLogs(response.data || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Greška pri dohvaćanju audit zapisa:", err);
          setError("Audit zapis nije moguće učitati");
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, entityType, entityId, parentId, limit]);

  return {
    logs,
    loading,
    error,
    refresh: fetchLogs,
  };
};

const AuditTimelinePanel = ({
  title = "Povijest aktivnosti",
  logs = [],
  loading = false,
  error = null,
  emptyMessage = "Nema dostupnih audit zapisa.",
  className = "",
}) => {
  const classes = ["space-y-3"];
  if (className) {
    classes.push(className);
  }

  const entries = Array.isArray(logs) ? logs : [];

  return (
    <div className={classes.join(" ")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {loading && (
          <span className="text-xs text-muted-foreground">Učitavam…</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Molimo pričekajte…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((log) => {
            const key =
              log.id || log.request_id || `${log.path}-${log.timestamp}`;
            return (
              <li
                key={key}
                className="rounded-lg border border-border/60 bg-background/80 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-border/70 text-muted-foreground uppercase"
                    >
                      {log.method}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {log.user || "Nepoznati korisnik"}
                    </span>
                    {log.role && (
                      <span className="text-muted-foreground">{log.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {typeof log.duration_ms === "number" && (
                      <span className="text-[11px]">{`${Math.round(log.duration_ms)} ms`}</span>
                    )}
                    <span className="text-[11px]">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                </div>
                <div className="mt-1 break-words text-muted-foreground/80">
                  <span className="font-medium text-foreground">Ruta:</span>{" "}
                  {log.path}
                </div>
                {Array.isArray(log.scopes) && log.scopes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground/80">
                    {log.scopes.slice(0, 4).map((scope) => (
                      <Badge
                        key={scope}
                        variant="outline"
                        className="border-dashed border-border/70 text-muted-foreground"
                      >
                        {scope}
                      </Badge>
                    ))}
                    {log.scopes.length > 4 && (
                      <span className="text-muted-foreground/60">
                        +{log.scopes.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {log.changes && (
                  <details className="mt-2 rounded border border-border/40 bg-white/80 p-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                      Promjene
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-muted-foreground">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  </details>
                )}
                {log.request_payload && (
                  <details className="mt-2 rounded border border-border/40 bg-white/80 p-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                      Payload
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-muted-foreground">
                      {JSON.stringify(log.request_payload, null, 2)}
                    </pre>
                  </details>
                )}
                {log.message && (
                  <p className="mt-2 text-[11px] text-destructive">
                    {log.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

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
    const currentDate = reminder.datum_podsjetnika
      ? new Date(reminder.datum_podsjetnika).getTime()
      : Number.POSITIVE_INFINITY;
    const existingDate = existing.datum_podsjetnika
      ? new Date(existing.datum_podsjetnika).getTime()
      : Number.POSITIVE_INFINITY;
    if (currentDate < existingDate) {
      map.set(reminder.id, reminder);
    }
  }
  return Array.from(map.values());
};

export const TenantSwitcher = ({ onLogout }) => {
  const { tenantId, changeTenant } = useEntityStore();
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantsError, setTenantsError] = useState(null);
  const labelId = useId();
  const navigate = useNavigate();

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const response = await api.getTenants();
      setTenants(response.data || []);
      setTenantsError(null);
    } catch (err) {
      console.error("Greška pri dohvaćanju tenant profila", err);
      setTenantsError(err);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const sortedTenants = useMemo(() => {
    return tenants
      .slice()
      .sort((a, b) => (a.naziv || "").localeCompare(b.naziv || ""));
  }, [tenants]);

  const selectedTenant = useMemo(
    () => sortedTenants.find((tenant) => tenant.id === tenantId),
    [sortedTenants, tenantId],
  );

  const handleSelectTenant = useCallback(
    async (id) => {
      if (!id || id === tenantId) {
        return;
      }
      const resolved = changeTenant(id);
      if (resolved) {
        if (typeof window !== "undefined" && window.location?.reload) {
          window.location.reload();
          return;
        }
        await loadTenants();
      }
    },
    [changeTenant, loadTenants, tenantId],
  );

  const handleNavigateProfiles = useCallback(() => {
    if (!canManageTenants(selectedTenant?.role)) {
      toast("Nedostaju ovlasti", {
        description:
          "Samo vlasnici ili administratori mogu upravljati profilima.",
      });
      return;
    }
    navigate("/profili");
  }, [navigate, selectedTenant?.role]);

  const handleLogout = useCallback(() => {
    onLogout?.();
  }, [onLogout]);

  const buttonLabel =
    selectedTenant?.naziv ||
    (loadingTenants
      ? "Učitavanje profila..."
      : tenantsError
        ? "Profil nije dostupan"
        : tenants.length
          ? "Odaberite profil"
          : "Nema profila");

  return (
    <div className="flex flex-col gap-1 sm:w-auto">
      <Label
        id={labelId}
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:sr-only"
      >
        Aktivni profil
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-border/70 bg-white/90 text-left text-sm font-medium shadow-sm sm:w-[240px]"
            aria-labelledby={labelId}
          >
            <span className="flex flex-col">
              <span className="font-semibold text-foreground">
                {buttonLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuLabel>Moji profili</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loadingTenants && (
            <DropdownMenuItem disabled>Učitavanje...</DropdownMenuItem>
          )}
          {tenantsError && !loadingTenants && (
            <DropdownMenuItem disabled className="text-destructive">
              Nije moguće učitati profile
            </DropdownMenuItem>
          )}
          {!loadingTenants && !tenantsError && sortedTenants.length === 0 && (
            <DropdownMenuItem disabled>Još nema profila</DropdownMenuItem>
          )}
          {sortedTenants.map((tenant) => {
            const isActive = tenant.id === tenantId;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelectTenant(tenant.id);
                }}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {tenant.naziv || "Bez naziva"}
                  </span>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </div>
                {tenant.role && (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatRoleLabel(tenant.role)}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Status: {tenant.status}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              handleNavigateProfiles();
            }}
          >
            <Settings className="mr-2 h-4 w-4" /> Upravljanje profilima
          </DropdownMenuItem>
          {onLogout && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleLogout();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Odjava
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Navigation Component
const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const navItems = [
    { path: "/", icon: Home, label: "Dashboard" },
    { path: "/nekretnine", icon: Building, label: "Nekretnine" },
    { path: "/zakupnici", icon: Users, label: "Zakupnici" },
    { path: "/ugovori", icon: Calendar, label: "Ugovori" },
    { path: "/odrzavanje", icon: Wrench, label: "Održavanje" },
    { path: "/dokumenti", icon: FileText, label: "Dokumenti" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <img
                  src={logoMain}
                  alt="Riforma"
                  className="h-10 w-auto sm:h-12"
                />
              </Link>
              <div className="hidden md:flex items-center gap-1 rounded-full border border-border/60 bg-white/80 px-2 py-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <TenantSwitcher onLogout={handleLogout} />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-xl border border-border/60 bg-white/80 p-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <TenantSwitcher onLogout={handleLogout} />
            </div>
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
        api.getZakupnici(),
      ]);

      const ugovor = ugovorRes.data.find((u) => u.id === podsjetnik.ugovor_id);
      const nekretnina = nekretnineRes.data.find(
        (n) => n.id === ugovor?.nekretnina_id,
      );
      const zakupnik = zakupniciRes.data.find(
        (z) => z.id === ugovor?.zakupnik_id,
      );

      setUgovorDetails({ ugovor, nekretnina, zakupnik });
    } catch (error) {
      console.error("Greška pri dohvaćanju detalja ugovora:", error);
    }
  };

  const handleReminderClick = () => {
    if (podsjetnik.tip === "istek_ugovora") {
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
        datum_potpisivanja: new Date().toISOString().split("T")[0],
        datum_pocetka: noviDatumPocetka.toISOString().split("T")[0],
        datum_zavrsetka: noviDatumZavrsetka.toISOString().split("T")[0],
        trajanje_mjeseci: godina * 12,
        rok_otkaza_dani: trenutniUgovor.rok_otkaza_dani,
        osnovna_zakupnina:
          trenutniUgovor.osnovna_zakupnina * (1 + 0.03 * godina), // 3% godišnje povećanje
        zakupnina_po_m2: trenutniUgovor.zakupnina_po_m2
          ? trenutniUgovor.zakupnina_po_m2 * (1 + 0.03 * godina)
          : null,
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
        _oldContractId: trenutniUgovor.id,
      };

      // Spremi template u sessionStorage i preusmjeri
      sessionStorage.setItem(
        "renewalTemplate",
        JSON.stringify(noviUgovorTemplate),
      );
      setShowRenewalDialog(false);
      navigate("/ugovori?action=renew");
    } catch (error) {
      console.error("Greška pri pripremi produška ugovora:", error);
      toast.error("Greška pri pripremi produžetka ugovora");
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
    if (dani <= 30) return "border border-red-200 bg-red-50 hover:bg-red-100";
    if (dani <= 60)
      return "border border-amber-200 bg-amber-50 hover:bg-amber-100";
    return "border border-primary/30 bg-primary/5 hover:bg-primary/10";
  };

  const getPriorityBadge = (dani) => {
    if (dani <= 30) {
      return (
        <Badge className="border-none bg-red-100 text-red-700">Hitno</Badge>
      );
    }
    if (dani <= 60) {
      return (
        <Badge className="border-none bg-amber-100 text-amber-700">
          Priprema
        </Badge>
      );
    }
    return (
      <Badge className="border-none bg-primary/10 text-primary">
        Informativno
      </Badge>
    );
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
              {podsjetnik.tip === "istek_ugovora"
                ? "ISTEK UGOVORA"
                : podsjetnik.tip.toUpperCase()}
            </h4>
            {getPriorityBadge(podsjetnik.dani_prije)}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">
              <span role="img" aria-hidden="true">
                📋
              </span>{" "}
              {ugovorDetails.ugovor?.interna_oznaka}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">
                🏢
              </span>{" "}
              {ugovorDetails.nekretnina?.naziv} -{" "}
              {ugovorDetails.nekretnina?.adresa}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">
                👤
              </span>{" "}
              {ugovorDetails.zakupnik?.naziv_firme ||
                ugovorDetails.zakupnik?.ime_prezime}
            </p>
            <p className="text-sm text-muted-foreground">
              <span role="img" aria-hidden="true">
                📅
              </span>{" "}
              Ističe:{" "}
              {new Date(
                ugovorDetails.ugovor?.datum_zavrsetka,
              ).toLocaleDateString()}
              <span className="ml-2 font-semibold text-red-600">
                (za {podsjetnik.dani_prije} dana)
              </span>
            </p>
            <p className="text-sm font-semibold text-primary">
              <span role="img" aria-hidden="true">
                💰
              </span>{" "}
              {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()}{" "}
              €/mjesec
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Pokreni radnju
          </div>
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
                  toast.success("Podsjetnik je označen kao riješen");
                  // Refresh dashboard
                  window.location.reload();
                } catch (error) {
                  console.error("Greška pri označavanju podsjetnika:", error);
                  toast.error("Greška pri označavanju podsjetnika");
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
        <DialogContent
          className="max-w-2xl"
          aria-describedby="renewal-dialog-description"
        >
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
                  <span className="font-semibold text-primary">
                    Nekretnina:
                  </span>{" "}
                  {ugovorDetails.nekretnina?.naziv}
                </div>
                <div>
                  <span className="font-semibold text-primary">Zakupnik:</span>{" "}
                  {ugovorDetails.zakupnik?.naziv_firme ||
                    ugovorDetails.zakupnik?.ime_prezime}
                </div>
                <div>
                  <span className="font-semibold text-primary">
                    Trenutna kirija:
                  </span>{" "}
                  {ugovorDetails.ugovor?.osnovna_zakupnina?.toLocaleString()} €
                </div>
                <div>
                  <span className="font-semibold text-primary">Ističe:</span>{" "}
                  {new Date(
                    ugovorDetails.ugovor?.datum_zavrsetka,
                  ).toLocaleDateString()}
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
                        <h4 className="text-lg font-semibold text-foreground">
                          1 Godina
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija:{" "}
                          {(
                            (ugovorDetails.ugovor?.osnovna_zakupnina || 0) *
                            1.03
                          ).toLocaleString()}{" "}
                          €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          Povećanje: 3% (standardno)
                        </p>
                      </div>
                      <Badge
                        variant="default"
                        className="rounded-full bg-primary text-primary-foreground"
                      >
                        Standardno
                      </Badge>
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
                        <h4 className="text-lg font-semibold text-foreground">
                          2 Godine
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija:{" "}
                          {(
                            (ugovorDetails.ugovor?.osnovna_zakupnina || 0) *
                            1.06
                          ).toLocaleString()}{" "}
                          €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          Povećanje: 6% (3% godišnje x 2)
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full border-none bg-accent text-primary-foreground"
                      >
                        Preporučeno
                      </Badge>
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
                        <h4 className="text-lg font-semibold text-foreground">
                          5 Godina
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Nova kirija:{" "}
                          {(
                            (ugovorDetails.ugovor?.osnovna_zakupnina || 0) *
                            1.15
                          ).toLocaleString()}{" "}
                          €/mjesec
                        </p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          Povećanje: 15% (3% godišnje x 5)
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/40 text-primary"
                      >
                        Dugoročno
                      </Badge>
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
                onClick={() => navigate("/ugovori")}
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
const MAINTENANCE_STATUS_META = {
  novi: {
    title: "Novi",
    description: "Prijave koje čekaju trijažu",
    cardBorderClass: "border-l-4 border-sky-500",
    badgeClass: "border border-sky-200 bg-sky-100 text-sky-700",
  },
  planiran: {
    title: "Planiran",
    description: "Termin i resursi su definirani",
    cardBorderClass: "border-l-4 border-amber-500",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-700",
  },
  u_tijeku: {
    title: "U tijeku",
    description: "Radovi su u tijeku",
    cardBorderClass: "border-l-4 border-blue-500",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700",
  },
  ceka_dobavljaca: {
    title: "Čeka dobavljača",
    description: "Blokirano dok ne stigne dobavljač",
    cardBorderClass: "border-l-4 border-purple-500",
    badgeClass: "border border-purple-200 bg-purple-100 text-purple-700",
  },
  potrebna_odluka: {
    title: "Potrebna odluka",
    description: "Čeka odobrenje ili dodatni input",
    cardBorderClass: "border-l-4 border-rose-500",
    badgeClass: "border border-rose-200 bg-rose-100 text-rose-700",
  },
  zavrseno: {
    title: "Završeno",
    description: "Radni nalog je izvršen",
    cardBorderClass: "border-l-4 border-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  arhivirano: {
    title: "Arhivirano",
    description: "Ostavljeno za evidenciju",
    cardBorderClass: "border-l-4 border-slate-400",
    badgeClass: "border border-slate-200 bg-slate-100 text-slate-600",
  },
};

const MAINTENANCE_STATUS_ORDER = [
  "novi",
  "planiran",
  "u_tijeku",
  "ceka_dobavljaca",
  "potrebna_odluka",
  "zavrseno",
];
const ALL_MAINTENANCE_STATUSES = [...MAINTENANCE_STATUS_ORDER, "arhivirano"];

const MAINTENANCE_PRIORITY_CONFIG = {
  nisko: {
    label: "Nizak prioritet",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  srednje: {
    label: "Srednji prioritet",
    className: "border border-sky-200 bg-sky-50 text-sky-700",
  },
  visoko: {
    label: "Visok prioritet",
    className: "border border-orange-200 bg-orange-50 text-orange-700",
  },
  kriticno: {
    label: "Kritično",
    className: "border border-red-200 bg-red-50 text-red-700",
  },
};

const MAINTENANCE_PRIORITY_ORDER = ["kriticno", "visoko", "srednje", "nisko"];

const EMPTY_MAINTENANCE_FORM = {
  naziv: "",
  opis: "",
  prioritet: "srednje",
  status: "novi",
  nekretnina_id: "",
  property_unit_id: "",
  prijavio: "",
  dodijeljeno: "",
  rok: "",
  oznake: "",
  procijenjeni_trosak: "",
  stvarni_trosak: "",
};

const MaintenanceBoard = ({
  enableFilters = false,
  enableList = false,
  enableDetails = true,
  title = "Radni nalozi održavanja",
  description = "Kanban pregled naloga kako bi odjel upravljanja nekretninama imao jasan uvid.",
}) => {
  const {
    maintenanceTasks,
    nekretnine,
    propertyUnitsById,
    propertyUnitsByProperty,
    refreshMaintenanceTasks,
    syncMaintenanceTask,
    loading: storeLoading,
  } = useEntityStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_MAINTENANCE_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    prioritet: "all",
    nekretnina: "all",
    status: "all",
    dueFrom: "",
    dueTo: "",
    oznaka: "",
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentForm, setCommentForm] = useState({ author: "", message: "" });
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);

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
          .split(",")
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
      if (filters.prioritet !== "all" && task.prioritet !== filters.prioritet) {
        return false;
      }
      if (filters.status !== "all" && task.status !== filters.status) {
        return false;
      }
      if (
        filters.nekretnina !== "all" &&
        task.nekretnina_id !== filters.nekretnina
      ) {
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
        const matchesLabels = labelTerms.every((term) =>
          labels.some((label) => label.includes(term)),
        );
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
          .join(" ")
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
        const firstDueValue =
          firstDue && !Number.isNaN(firstDue.getTime())
            ? firstDue.getTime()
            : Number.POSITIVE_INFINITY;
        const secondDueValue =
          secondDue && !Number.isNaN(secondDue.getTime())
            ? secondDue.getTime()
            : Number.POSITIVE_INFINITY;
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

  const columns = useMemo(
    () =>
      MAINTENANCE_STATUS_ORDER.map((status) => ({
        status,
        meta: MAINTENANCE_STATUS_META[status],
        tasks: groupedTasks[status] || [],
      })),
    [groupedTasks],
  );

  const archivedTasks = groupedTasks.arhivirano || [];

  const unitsForSelectedProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return [];
    }
    return propertyUnitsByProperty[formData.nekretnina_id] || [];
  }, [formData.nekretnina_id, propertyUnitsByProperty]);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_MAINTENANCE_FORM);
  }, []);

  const handleDialogOpenChange = useCallback(
    (open) => {
      setIsDialogOpen(open);
      if (!open) {
        resetForm();
      }
    },
    [resetForm],
  );

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!formData.naziv.trim()) {
      toast.error("Naziv radnog naloga je obavezan");
      return;
    }
    setIsSubmitting(true);
    try {
      const normaliseRelation = (value) => {
        if (!value || value === "none") {
          return undefined;
        }
        return value;
      };
      const parseCost = (value) => {
        if (value === null || value === undefined || value === "") {
          return undefined;
        }
        if (typeof value === "number") {
          return Number.isFinite(value) ? value : undefined;
        }
        const normalised = value.replace(/[^0-9,.-]/g, "").replace(",", ".");
        const parsed = Number(normalised);
        return Number.isFinite(parsed) ? parsed : undefined;
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
          ? formData.oznake
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        procijenjeni_trosak: parseCost(formData.procijenjeni_trosak),
        stvarni_trosak: parseCost(formData.stvarni_trosak),
      };
      const response = await api.createMaintenanceTask(payload);
      toast.success("Radni nalog je dodan");
      handleDialogOpenChange(false);
      syncMaintenanceTask?.(response.data);
      await refreshMaintenanceTasks();
    } catch (error) {
      console.error("Greška pri kreiranju radnog naloga:", error);
      const message =
        error.response?.data?.detail || "Greška pri kreiranju naloga";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchTaskDetails = useCallback(
    async (taskId) => {
      setDetailLoading(true);
      try {
        const response = await api.getMaintenanceTask(taskId);
        setSelectedTask(response.data);
        syncMaintenanceTask?.(response.data);
        return response.data;
      } catch (error) {
        console.error("Greška pri dohvaćanju detalja radnog naloga:", error);
        toast.error("Greška pri dohvaćanju detalja naloga");
        throw error;
      } finally {
        setDetailLoading(false);
      }
    },
    [syncMaintenanceTask],
  );

  const handleCardClick = useCallback(
    (task) => {
      if (!enableDetails) {
        return;
      }
      setSelectedTaskId(task.id);
      setSelectedTask(task);
      setDetailOpen(true);
      fetchTaskDetails(task.id);
    },
    [enableDetails, fetchTaskDetails],
  );

  const handleDetailOpenChange = useCallback((open) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedTaskId(null);
      setSelectedTask(null);
      setCommentForm({ author: "", message: "" });
    }
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: "",
      prioritet: "all",
      nekretnina: "all",
      status: "all",
      dueFrom: "",
      dueTo: "",
      oznaka: "",
    });
  }, []);

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTaskId) {
      return;
    }
    if (!commentForm.message.trim()) {
      toast.error("Komentar ne može biti prazan");
      return;
    }
    setCommentSubmitting(true);
    try {
      const response = await api.addMaintenanceComment(selectedTaskId, {
        poruka: commentForm.message.trim(),
        autor: commentForm.author.trim() || undefined,
      });
      toast.success("Komentar je dodan");
      setCommentForm({ author: "", message: "" });
      const updatedTask = response.data;
      syncMaintenanceTask?.(updatedTask);
      setSelectedTask(updatedTask);
      await refreshMaintenanceTasks();
    } catch (error) {
      console.error("Greška pri dodavanju komentara:", error);
      const message =
        error.response?.data?.detail || "Greška pri dodavanju komentara";
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
      const first = new Date(
        a.timestamp || a.vrijeme || a.created_at || 0,
      ).getTime();
      const second = new Date(
        b.timestamp || b.vrijeme || b.created_at || 0,
      ).getTime();
      return second - first;
    });
  }, [selectedTask]);

  const resolutionHours = useMemo(() => {
    if (!selectedTask) {
      return null;
    }
    if (!selectedTask.kreiran) {
      return null;
    }
    const start = new Date(selectedTask.kreiran);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const finishSource = selectedTask.zavrseno_na || selectedTask.azuriran;
    if (!finishSource) {
      return null;
    }
    const finish = new Date(finishSource);
    if (Number.isNaN(finish.getTime())) {
      return null;
    }
    const diff = (finish.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Number.isFinite(diff) && diff >= 0 ? diff : null;
  }, [selectedTask]);

  const selectedTaskPriority = useMemo(() => {
    if (!selectedTask) {
      return null;
    }
    return (
      MAINTENANCE_PRIORITY_CONFIG[selectedTask.prioritet] ||
      MAINTENANCE_PRIORITY_CONFIG.srednje
    );
  }, [selectedTask]);

  const activityLabels = {
    kreiran: "Nalog kreiran",
    promjena_statusa: "Promjena statusa",
    komentar: "Komentar",
    uredjeno: "Ažuriranje naloga",
  };

  const handleStatusChange = useCallback(
    async (task, nextStatus) => {
      if (!task || !task.id || !nextStatus) {
        return;
      }

      const taskId = task.id;
      const previousStatus = task.status;
      const previousUpdatedAt = task.azuriran || null;
      const previousCompletedAt = task.zavrseno_na || null;
      const nowIso = new Date().toISOString();
      const isCompleted = ["zavrseno", "arhivirano"].includes(nextStatus);

      const optimisticTask = {
        ...task,
        status: nextStatus,
        azuriran: nowIso,
        zavrseno_na: isCompleted ? nowIso : null,
      };

      setStatusUpdating(taskId);
      syncMaintenanceTask?.(optimisticTask);

      if (enableDetails && selectedTaskId === taskId) {
        setSelectedTask((current) => {
          if (!current || current.id !== taskId) {
            return current;
          }
          return { ...current, ...optimisticTask };
        });
      }

      try {
        const response = await api.updateMaintenanceTask(taskId, {
          status: nextStatus,
        });
        const updatedTask = response.data;
        syncMaintenanceTask?.(updatedTask);
        toast.success("Status radnog naloga je ažuriran");

        if (enableDetails && selectedTaskId === taskId) {
          setSelectedTask(updatedTask);
        }
      } catch (error) {
        console.error("Greška pri promjeni statusa naloga:", error);
        const message =
          error.response?.data?.detail || "Ažuriranje statusa nije uspjelo";
        toast.error(message);

        const revertTask = {
          ...task,
          status: previousStatus,
          azuriran: previousUpdatedAt,
          zavrseno_na: previousCompletedAt,
        };
        syncMaintenanceTask?.(revertTask);

        if (enableDetails && selectedTaskId === taskId) {
          setSelectedTask((current) => {
            if (!current || current.id !== taskId) {
              return current;
            }
            return { ...current, ...revertTask };
          });
        }

        if (refreshMaintenanceTasks) {
          refreshMaintenanceTasks().catch((err) => {
            console.error("Greška pri vraćanju liste naloga:", err);
          });
        }
      } finally {
        setStatusUpdating(null);
      }
    },
    [
      enableDetails,
      refreshMaintenanceTasks,
      selectedTaskId,
      syncMaintenanceTask,
    ],
  );

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
        filters.prioritet !== "all" ||
        filters.status !== "all" ||
        filters.nekretnina !== "all" ||
        filters.dueFrom ||
        filters.dueTo,
    );
  }, [filters]);

  const renderTaskCard = useCallback(
    (task, columnStatus = null) => {
      const statusMeta = MAINTENANCE_STATUS_META[task.status] || {};
      const priorityMeta =
        MAINTENANCE_PRIORITY_CONFIG[task.prioritet] ||
        MAINTENANCE_PRIORITY_CONFIG.srednje;
      const property = propertyMap[task.nekretnina_id];
      const unit = propertyUnitsById?.[task.property_unit_id];
      const dueDate = task.rok ? new Date(task.rok) : null;
      const validDueDate =
        dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
      const overdue =
        validDueDate &&
        validDueDate < today &&
        !["zavrseno", "arhivirano"].includes(task.status);
      const statusLabel = statusMeta.title || task.status;
      const hideStatusBadge = columnStatus === task.status;
      const dueLabel = task.rok ? formatDate(task.rok) : "Bez roka";
      const isCompleted =
        task.status === "zavrseno" || task.status === "arhivirano";

      const cardClasses = [
        "border border-border/60 shadow-sm",
        "w-full max-w-full min-w-0 overflow-hidden",
        statusMeta.cardBorderClass || "",
        enableDetails
          ? "cursor-pointer transition hover:border-primary/60"
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <Card
          key={task.id}
          className={cardClasses}
          onClick={() => {
            if (enableDetails) {
              handleCardClick(task);
            }
          }}
          role={enableDetails ? "button" : undefined}
        >
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  {task.naziv}
                </CardTitle>
                <p className="text-xs text-muted-foreground/80">
                  {property ? property.naziv : "Nepovezana nekretnina"}
                  {unit ? ` • ${unit.naziv || unit.oznaka || unit.id}` : ""}
                </p>
              </div>
              {!hideStatusBadge && (
                <Badge
                  variant="outline"
                  className={
                    statusMeta.badgeClass ||
                    "border border-border bg-muted text-muted-foreground"
                  }
                >
                  {statusLabel}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {task.opis && (
              <p className="text-sm text-muted-foreground">{task.opis}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/90">
              <Badge variant="outline" className={priorityMeta.className}>
                {priorityMeta.label}
              </Badge>
              <div
                className={`flex items-center gap-1 ${overdue ? "font-semibold text-red-600" : ""}`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{dueLabel}</span>
              </div>
              {task.prijavio && (
                <span>
                  Prijavio:{" "}
                  <span className="font-medium text-foreground">
                    {task.prijavio}
                  </span>
                </span>
              )}
              {task.dodijeljeno && (
                <span>
                  Dodijeljeno:{" "}
                  <span className="font-medium text-foreground">
                    {task.dodijeljeno}
                  </span>
                </span>
              )}
            </div>

            {task.oznake && task.oznake.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.oznake.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="border-dashed border-border/50 text-muted-foreground"
                  >
                    #{label}
                  </Badge>
                ))}
              </div>
            )}

            {(task.procijenjeni_trosak != null ||
              task.stvarni_trosak != null) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/90">
                {task.procijenjeni_trosak != null && (
                  <span>
                    Procjena:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(task.procijenjeni_trosak)}
                    </span>
                  </span>
                )}
                {task.stvarni_trosak != null && (
                  <span>
                    Trošak:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(task.stvarni_trosak)}
                    </span>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="min-w-[140px] flex-1">
                <Select
                  value={task.status}
                  onValueChange={(value) => handleStatusChange(task, value)}
                  disabled={statusUpdating === task.id}
                >
                  <SelectTrigger
                    className="h-8 w-full"
                    onClick={(event) => event.stopPropagation()}
                  >
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
              <div className="flex flex-shrink-0 items-center gap-2">
                {task.status !== "arhivirano" && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStatusChange(task, "arhivirano");
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
    },
    [
      enableDetails,
      handleCardClick,
      handleStatusChange,
      propertyMap,
      propertyUnitsById,
      statusUpdating,
      today,
    ],
  );

  return (
    <section className="space-y-4" id="maintenance-board">
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-center">
        {(title ||
          description ||
          (enableFilters && maintenanceTasks.length > 0)) && (
          <div className="space-y-1">
            {title && (
              <h2 className="text-2xl font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {enableFilters && (
              <p className="text-xs text-muted-foreground">
                Prikazano {filteredTasks.length} od {maintenanceTasks.length}{" "}
                naloga
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="ml-2 text-primary underline-offset-2 hover:underline"
                  >
                    Poništi filtre
                  </button>
                )}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {enableFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFiltersDialogOpen(true)}
            >
              Filteri
            </Button>
          )}
          <Button
            type="button"
            onClick={handleOpenDialog}
            className="md:w-auto"
            data-testid="add-maintenance-task"
          >
            <Plus className="mr-2 h-4 w-4" /> Dodaj radni nalog
          </Button>
        </div>
      </div>

      {enableFilters && (
        <Dialog
          open={isFiltersDialogOpen}
          onOpenChange={setIsFiltersDialogOpen}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Filtriraj radne naloge</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Suzi prikaz prema prioritetu, statusu, oznakama ili rokovima.
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="maintenance-search">Pretraži naloge</Label>
                  <Input
                    id="maintenance-search"
                    value={filters.search}
                    onChange={(event) =>
                      handleFilterChange("search", event.target.value)
                    }
                    placeholder="npr. klima, lift, hitno"
                  />
                </div>
                <div>
                  <Label htmlFor="maintenance-prioritet-filter">
                    Prioritet
                  </Label>
                  <Select
                    value={filters.prioritet}
                    onValueChange={(value) =>
                      handleFilterChange("prioritet", value)
                    }
                  >
                    <SelectTrigger id="maintenance-prioritet-filter">
                      <SelectValue placeholder="Svi prioriteti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Svi prioriteti</SelectItem>
                      {Object.entries(MAINTENANCE_PRIORITY_CONFIG).map(
                        ([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="maintenance-status-filter">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      handleFilterChange("status", value)
                    }
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
                <div>
                  <Label htmlFor="maintenance-property-filter">
                    Nekretnina
                  </Label>
                  <Select
                    value={filters.nekretnina}
                    onValueChange={(value) =>
                      handleFilterChange("nekretnina", value)
                    }
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
                <div>
                  <Label htmlFor="maintenance-label-filter">Oznake</Label>
                  <Input
                    id="maintenance-label-filter"
                    value={filters.oznaka}
                    onChange={(event) =>
                      handleFilterChange("oznaka", event.target.value)
                    }
                    placeholder="npr. elektrika, servis"
                  />
                </div>
                <div>
                  <Label htmlFor="maintenance-due-from">Rok od</Label>
                  <Input
                    id="maintenance-due-from"
                    type="date"
                    value={filters.dueFrom}
                    onChange={(event) =>
                      handleFilterChange("dueFrom", event.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="maintenance-due-to">Rok do</Label>
                  <Input
                    id="maintenance-due-to"
                    type="date"
                    value={filters.dueTo}
                    onChange={(event) =>
                      handleFilterChange("dueTo", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-6">
              <div className="flex w-full justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    handleResetFilters();
                    setIsFiltersDialogOpen(false);
                  }}
                >
                  Poništi sve
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsFiltersDialogOpen(false)}
                >
                  Zatvori
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {columns.map(({ status, meta, tasks }) => (
            <div key={status} className="w-72 flex-shrink-0">
              <div className="flex h-[calc(100vh-320px)] min-h-[24rem] flex-col rounded-xl border border-border/60 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-border/50 px-4 pt-4 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {meta?.title || status}
                    </h3>
                    <p className="text-xs text-muted-foreground/80">
                      {meta?.description}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      meta?.badgeClass ||
                      "border border-border text-muted-foreground"
                    }
                  >
                    {tasks.length}
                  </Badge>
                </div>
                <ScrollArea className="flex-1 px-4 pb-4">
                  <div className="space-y-3 pt-3 pr-2">
                    {isLoading ? (
                      <p className="text-xs text-muted-foreground/70">
                        Učitavam radne naloge…
                      </p>
                    ) : tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60">
                        Nema naloga u ovoj fazi.
                      </p>
                    ) : (
                      tasks.map((task) => renderTaskCard(task, status))
                    )}
                  </div>
                </ScrollArea>
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
            {archivedTasks.map((task) => renderTaskCard(task, "arhivirano"))}
          </div>
        </details>
      )}

      {enableList && null}

      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <div className="flex flex-col">
            <DialogHeader className="border-b border-border/60 px-6 py-4">
              <DialogTitle>
                {selectedTask?.naziv || "Detalji radnog naloga"}
              </DialogTitle>
              {selectedTask && (
                <p className="text-sm text-muted-foreground">
                  {MAINTENANCE_STATUS_META[selectedTask.status]?.title ||
                    selectedTask.status}{" "}
                  •{" "}
                  {MAINTENANCE_PRIORITY_CONFIG[selectedTask.prioritet]?.label ||
                    "Prioritet"}
                </p>
              )}
            </DialogHeader>

            {detailLoading ? (
              <div className="px-6 py-10">
                <p className="text-sm text-muted-foreground">
                  Učitavam detalje naloga…
                </p>
              </div>
            ) : selectedTask ? (
              <div className="flex flex-col-reverse lg:flex-row-reverse">
                <aside className="border-t border-border/60 bg-muted/30 px-6 py-6 text-sm lg:w-80 lg:border-l lg:border-t-0">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        Sažetak naloga
                      </h4>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Nekretnina
                          </dt>
                          <dd className="font-medium text-foreground">
                            {propertyMap[selectedTask.nekretnina_id]?.naziv ||
                              "Nije povezano"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Podprostor
                          </dt>
                          <dd className="font-medium text-foreground">
                            {propertyUnitsById?.[selectedTask.property_unit_id]
                              ?.naziv ||
                              propertyUnitsById?.[selectedTask.property_unit_id]
                                ?.oznaka ||
                              "Nije odabrano"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Prijavio
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.prijavio || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Dodijeljeno
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.dodijeljeno || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Rok
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.rok
                              ? formatDate(selectedTask.rok)
                              : "Bez roka"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Status
                          </dt>
                          <dd className="pt-1">
                            <Select
                              value={selectedTask.status}
                              onValueChange={(value) =>
                                handleStatusChange(selectedTask, value)
                              }
                              disabled={statusUpdating === selectedTask.id}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_MAINTENANCE_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {MAINTENANCE_STATUS_META[status]?.title ||
                                      status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Prioritet
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTaskPriority ? (
                              <Badge
                                variant="outline"
                                className={selectedTaskPriority.className}
                              >
                                {selectedTaskPriority.label}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Procijenjeni trošak
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.procijenjeni_trosak != null
                              ? formatCurrency(selectedTask.procijenjeni_trosak)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Stvarni trošak
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.stvarni_trosak != null
                              ? formatCurrency(selectedTask.stvarni_trosak)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Završeno
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedTask.zavrseno_na
                              ? formatDateTime(selectedTask.zavrseno_na)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            Vrijeme rješavanja
                          </dt>
                          <dd className="font-medium text-foreground">
                            {resolutionHours != null
                              ? `${resolutionHours.toFixed(1)} h`
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {selectedTask.oznake && selectedTask.oznake.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Oznake
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTask.oznake.map((label) => (
                            <Badge
                              key={label}
                              variant="outline"
                              className="border-dashed border-border/50 text-muted-foreground"
                            >
                              #{label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
                <ScrollArea className="max-h-[75vh] flex-1">
                  <div className="space-y-6 px-6 py-6">
                    {selectedTask.opis && (
                      <section className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          Opis naloga
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedTask.opis}
                        </p>
                      </section>
                    )}

                    <section className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          Timeline aktivnosti
                        </h4>
                        {activityItems.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {activityItems.length} zapisa
                          </span>
                        )}
                      </div>
                      {activityItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Još nema zabilježenih aktivnosti za ovaj nalog.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {activityItems.map((activity, index) => {
                            const label =
                              activityLabels[activity.tip] || activity.tip;
                            const statusLabel = activity.status
                              ? MAINTENANCE_STATUS_META[activity.status]
                                  ?.title || activity.status
                              : null;
                            const timestamp = formatDateTime(
                              activity.timestamp ||
                                activity.vrijeme ||
                                activity.created_at,
                            );
                            const key =
                              activity.id ||
                              `${activity.tip}-${timestamp || index}`;
                            return (
                              <li key={key} className="relative flex gap-3">
                                <div
                                  className="mt-1 h-full w-px bg-border"
                                  aria-hidden
                                />
                                <div className="flex-1 rounded-lg border border-border/60 bg-white/80 p-3 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="border-border text-muted-foreground"
                                      >
                                        {label}
                                      </Badge>
                                      {statusLabel && (
                                        <Badge
                                          variant="outline"
                                          className="border-primary/40 bg-primary/10 text-primary"
                                        >
                                          {statusLabel}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {timestamp}
                                    </span>
                                  </div>
                                  {activity.autor && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Autor:{" "}
                                      <span className="font-medium text-foreground">
                                        {activity.autor}
                                      </span>
                                    </p>
                                  )}
                                  {activity.opis && (
                                    <p className="mt-2 text-sm text-foreground">
                                      {activity.opis}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    <section className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        Dodaj komentar
                      </h4>
                      <form
                        onSubmit={handleCommentSubmit}
                        className="space-y-3"
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor="comment-author">
                              Autor komentara
                            </Label>
                            <Input
                              id="comment-author"
                              value={commentForm.author}
                              onChange={(event) =>
                                setCommentForm((prev) => ({
                                  ...prev,
                                  author: event.target.value,
                                }))
                              }
                              placeholder="npr. Voditelj održavanja"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor="comment-message">Komentar *</Label>
                            <Textarea
                              id="comment-message"
                              rows={3}
                              value={commentForm.message}
                              onChange={(event) =>
                                setCommentForm((prev) => ({
                                  ...prev,
                                  message: event.target.value,
                                }))
                              }
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
                            onClick={() =>
                              setCommentForm({ author: "", message: "" })
                            }
                            disabled={commentSubmitting}
                          >
                            Poništi
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={commentSubmitting}
                          >
                            {commentSubmitting ? "Spremam…" : "Dodaj komentar"}
                          </Button>
                        </div>
                      </form>
                    </section>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="px-6 py-10">
                <p className="text-sm text-muted-foreground">
                  Detalji naloga nisu dostupni.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dodaj radni nalog</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Zabilježite sve potrebne aktivnosti kako bi tim mogao reagirati na
              vrijeme.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-naziv">Naziv naloga *</Label>
                <Input
                  id="task-naziv"
                  value={formData.naziv}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      naziv: event.target.value,
                    }))
                  }
                  placeholder="npr. Servis klima uređaja"
                  required
                />
              </div>
              <div>
                <Label htmlFor="task-prioritet">Prioritet</Label>
                <Select
                  value={formData.prioritet}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, prioritet: value }))
                  }
                >
                  <SelectTrigger id="task-prioritet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINTENANCE_PRIORITY_CONFIG).map(
                      ([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
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
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      rok: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-nekretnina">Nekretnina</Label>
                <Select
                  value={formData.nekretnina_id || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      nekretnina_id: value === "none" ? "" : value,
                      property_unit_id: "",
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
                  value={formData.property_unit_id || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      property_unit_id: value === "none" ? "" : value,
                    }))
                  }
                  disabled={
                    !formData.nekretnina_id ||
                    unitsForSelectedProperty.length === 0
                  }
                >
                  <SelectTrigger id="task-unit">
                    <SelectValue
                      placeholder={
                        formData.nekretnina_id
                          ? "Odaberite podprostor"
                          : "Prvo odaberite nekretninu"
                      }
                    />
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
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      prijavio: event.target.value,
                    }))
                  }
                  placeholder="npr. Ana Perić"
                />
              </div>
              <div>
                <Label htmlFor="task-dodijeljeno">Voditelj naloga</Label>
                <Input
                  id="task-dodijeljeno"
                  value={formData.dodijeljeno}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      dodijeljeno: event.target.value,
                    }))
                  }
                  placeholder="npr. Voditelj održavanja"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="task-procjena">Procijenjeni trošak (€)</Label>
                <Input
                  id="task-procjena"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.procijenjeni_trosak}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      procijenjeni_trosak: event.target.value,
                    }))
                  }
                  placeholder="npr. 250"
                />
              </div>
              <div>
                <Label htmlFor="task-trosak">Stvarni trošak (€)</Label>
                <Input
                  id="task-trosak"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.stvarni_trosak}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      stvarni_trosak: event.target.value,
                    }))
                  }
                  placeholder="npr. 220"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="task-opis">Opis naloga</Label>
              <Textarea
                id="task-opis"
                value={formData.opis}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, opis: event.target.value }))
                }
                rows={4}
                placeholder="Detaljan opis problema, potrebni materijali ili upute za izvođača"
              />
            </div>

            <div>
              <Label htmlFor="task-oznake">Oznake</Label>
              <Input
                id="task-oznake"
                value={formData.oznake}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    oznake: event.target.value,
                  }))
                }
                placeholder="npr. elektrika, hitno"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Razdvojite oznake zarezom kako biste brže filtrirali zadatke.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Odustani
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Spremam…" : "Spremi nalog"}
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
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          Održavanje
        </h1>
        <p className="text-sm text-muted-foreground">
          Centralizirani pregled radnih naloga, timeline aktivnosti i popis svih
          zadataka.
        </p>
      </div>
      <MaintenanceBoard
        enableFilters
        enableList
        title={null}
        description={null}
      />
    </div>
  );
};

const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [activeReminders, setActiveReminders] = useState([]);
  const [allReminders, setAllReminders] = useState([]);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [remindersFilter, setRemindersFilter] = useState("svi");
  const [reminderSearch, setReminderSearch] = useState("");
  const { dokumenti, nekretnine, ugovori, zakupnici } = useEntityStore();

  const maintenanceKpi = dashboard?.maintenance_kpi || null;
  const formatHours = useCallback((value) => {
    if (value === null || value === undefined) {
      return "—";
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    return `${parsed.toFixed(1)} h`;
  }, []);

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
      console.error("Greška pri dohvaćanju dashboard podataka:", error);
      toast.error("Greška pri učitavanju dashboard-a");
    }
  };

  const fetchActiveReminders = async () => {
    try {
      const response = await api.getAktivniPodsjetnici();
      setActiveReminders(dedupeRemindersById(response.data));
    } catch (error) {
      console.error("Greška pri dohvaćanju podsjećanja:", error);
    }
  };

  const fetchAllReminders = async () => {
    try {
      const response = await api.getPodsjetnici();
      setAllReminders(dedupeRemindersById(response.data));
    } catch (error) {
      console.error("Greška pri dohvaćanju podsjećanja:", error);
    }
  };

  const getReminderLabel = (tip) => {
    const labels = {
      istek_ugovora: "Istek ugovora",
      obnova_garancije: "Obnova garancije",
      indeksacija: "Indeksacija",
    };
    return labels[tip] || tip;
  };

  const rentalCapacity = dashboard?.najamni_kapacitet || null;

  const getReminderContext = useCallback(
    (reminder) => {
      if (!reminder) {
        return { contract: null, property: null, tenant: null };
      }

      const contract =
        ugovori?.find((item) => item.id === reminder.ugovor_id) || null;
      const property = contract
        ? nekretnine?.find((item) => item.id === contract.nekretnina_id) || null
        : null;
      const tenant = contract
        ? zakupnici?.find((item) => item.id === contract.zakupnik_id) || null
        : null;

      return { contract, property, tenant };
    },
    [ugovori, nekretnine, zakupnici],
  );

  const isReminderValid = useCallback(
    (reminder) => {
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

      if (reminder.tip === "istek_ugovora") {
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
        const lead =
          rawLead === null || rawLead === undefined || rawLead === ""
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
            if (
              Math.abs(reminderDate.getTime() - expected.getTime()) >
              MS_PER_DAY * 2
            ) {
              return false;
            }
          }
        }
      }

      return true;
    },
    [getReminderContext],
  );

  const sanitizedActiveReminders = useMemo(
    () => activeReminders.filter(isReminderValid),
    [activeReminders, isReminderValid],
  );

  const sanitizedAllReminders = useMemo(
    () => allReminders.filter(isReminderValid),
    [allReminders, isReminderValid],
  );

  const upcomingReminders = useMemo(() => {
    return [...sanitizedActiveReminders]
      .sort(
        (a, b) => new Date(a.datum_podsjetnika) - new Date(b.datum_podsjetnika),
      )
      .slice(0, 5);
  }, [sanitizedActiveReminders]);

  const totalReminders = sanitizedAllReminders.length;
  const activeRemindersCount = sanitizedActiveReminders.length;
  const sentRemindersCount = useMemo(
    () => sanitizedAllReminders.filter((reminder) => reminder.poslan).length,
    [sanitizedAllReminders],
  );
  const highPriorityCount = useMemo(
    () =>
      sanitizedActiveReminders.filter((reminder) => reminder.dani_prije <= 30)
        .length,
    [sanitizedActiveReminders],
  );

  useEffect(() => {
    if (!showAllReminders) {
      setRemindersFilter("svi");
      setReminderSearch("");
    }
  }, [showAllReminders]);

  const filteredAllReminders = useMemo(() => {
    const base = [...sanitizedAllReminders].sort(
      (a, b) =>
        new Date(a.datum_podsjetnika || 0) - new Date(b.datum_podsjetnika || 0),
    );
    return base.filter((reminder) => {
      if (remindersFilter === "aktivni" && reminder.poslan) {
        return false;
      }
      if (remindersFilter === "poslani" && !reminder.poslan) {
        return false;
      }
      if (
        remindersFilter === "visok" &&
        (reminder.dani_prije === undefined || reminder.dani_prije > 30)
      ) {
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
          reminder.datum_podsjetnika
            ? new Date(reminder.datum_podsjetnika).toLocaleDateString("hr-HR")
            : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [
    sanitizedAllReminders,
    remindersFilter,
    reminderSearch,
    getReminderContext,
  ]);

  const revenueSeries = dashboard?.series?.monthly_revenue ?? [];

  const portfolioBreakdown = useMemo(() => {
    const entries = Array.isArray(dashboard?.portfolio_breakdown)
      ? [...dashboard.portfolio_breakdown]
      : [];
    return entries.sort((a, b) => {
      const valueA = parseNumericValue(a.total_value) || 0;
      const valueB = parseNumericValue(b.total_value) || 0;
      return valueB - valueA;
    });
  }, [dashboard?.portfolio_breakdown]);

  const formatCurrency = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "—";
    }
    return numeric.toLocaleString("hr-HR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  if (!dashboard) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Učitavam kontrolni centar…
      </div>
    );
  }

  const monthlyRevenueSeries = revenueSeries
    .map((point) => ({
      month: point?.month,
      value:
        typeof point?.value === "number"
          ? point.value
          : Number(point?.value ?? 0),
    }))
    .filter((point) => Number.isFinite(point.value));
  const currentMonthlyRevenueRaw =
    dashboard.mjesecni_prihod ?? monthlyRevenueSeries.at(-1)?.value ?? 0;
  const currentMonthlyRevenue = Number.isFinite(
    Number(currentMonthlyRevenueRaw),
  )
    ? Number(currentMonthlyRevenueRaw)
    : 0;
  const previousMonthlyRevenue =
    monthlyRevenueSeries.length > 1 ? monthlyRevenueSeries.at(-2).value : null;

  let monthlyRevenueTrend = "Nema podataka za usporedbu.";
  if (typeof previousMonthlyRevenue === "number") {
    if (previousMonthlyRevenue === 0) {
      monthlyRevenueTrend =
        currentMonthlyRevenue === 0
          ? "Prihod je nepromijenjen u odnosu na prošli mjesec."
          : "Prihod je ostvaren prvi put u odnosu na prošli mjesec.";
    } else {
      const deltaPercent =
        ((currentMonthlyRevenue - previousMonthlyRevenue) /
          previousMonthlyRevenue) *
        100;
      const formattedDelta = deltaPercent.toFixed(1);
      monthlyRevenueTrend =
        deltaPercent >= 0
          ? `+${formattedDelta}% u odnosu na prošli mjesec.`
          : `${formattedDelta}% u odnosu na prošli mjesec.`;
    }
  }

  const summaryCards = [
    {
      id: "ukupno-nekretnina-card",
      label: "Ukupno nekretnina",
      icon: Building,
      value: dashboard.ukupno_nekretnina,
    },
    {
      id: "aktivni-ugovori-card",
      label: "Aktivni ugovori",
      icon: Calendar,
      value: dashboard.aktivni_ugovori,
    },
    {
      id: "ugovori-na-isteku-card",
      label: "Ugovori na isteku",
      icon: Bell,
      value: dashboard.ugovori_na_isteku,
    },
    {
      id: "mjesecni-prihod-card",
      label: "Mjesecni prihod",
      icon: FileText,
      value: formatCurrency(currentMonthlyRevenue),
      suffix: " €",
      sublabel: monthlyRevenueTrend,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 md:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-primary">
              Kontrolni centar
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pratite vrijednost portfelja, uvjete zakupa i dokaze o
              usklađenosti iz jednog AI-kontroliranog sučelja.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90"
          >
            <Link to="/nekretnine">
              Dodaj novu nekretninu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(
          ({ id, label, icon: Icon, value, sublabel, suffix }) => (
            <Card key={id} data-testid={id} className="card-hover shadow-shell">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardTitle>
                  <Icon className="h-5 w-5 text-primary/70" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="truncate text-3xl font-semibold text-foreground">
                  {value}
                  {suffix ? (
                    <span className="ml-1 text-base font-medium text-muted-foreground">
                      {suffix}
                    </span>
                  ) : null}
                </div>
                {sublabel && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground/80">
                    {sublabel}
                  </p>
                )}
              </CardContent>
            </Card>
          ),
        )}

        <Card
          data-testid="vrijednost-portfelja-card"
          className="border-0 bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Vrijednost portfelja
              </CardTitle>
              <Building className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="truncate text-2xl font-bold">
              {dashboard.ukupna_vrijednost_portfelja?.toLocaleString()} €
            </div>
            <p className="text-xs text-white/80">Ukupna tržišna vrijednost</p>
          </CardContent>
        </Card>

        <Card
          data-testid="godisnji-prinos-card"
          className="border-0 bg-gradient-to-r from-accent to-primary text-white shadow-xl"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Godišnji prinos
              </CardTitle>
              <DollarSign className="h-4 w-4 text-white/80" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="truncate text-2xl font-bold">
              {dashboard.godisnji_prinos?.toLocaleString()} €
            </div>
            <p className="text-xs text-white/80">
              {dashboard.prinos_postotak}% ROI
            </p>
          </CardContent>
        </Card>
      </div>

      {rentalCapacity && (
        <Card className="shadow-shell" data-testid="rental-capacity-card">
          <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Najamni kapacitet
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Praćenje popunjenosti i raspoloživih podprostora u portfelju.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={Math.min(
                  100,
                  Math.max(0, rentalCapacity.occupancy_rate ?? 0),
                )}
                className="w-36"
              />
              <span className="text-sm font-semibold text-foreground">
                {rentalCapacity.occupancy_rate != null
                  ? formatPercentage(rentalCapacity.occupancy_rate)
                  : "—"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ukupno jedinica
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {rentalCapacity.total_units ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Iznajmljeno
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {rentalCapacity.occupied_units ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dostupno
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {rentalCapacity.available_units ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Rezervirano / pipeline
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {rentalCapacity.reserved_units ?? 0}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  Top prazni podprostori
                </h4>
                {rentalCapacity.top_vacant_units &&
                rentalCapacity.top_vacant_units.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rentalCapacity.top_vacant_units.map((unit) => (
                      <li
                        key={unit.id}
                        className="rounded-lg border border-border/50 bg-white/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {unit.naziv || unit.oznaka}
                          </span>
                          <span>
                            {unit.osnovna_zakupnina != null
                              ? formatCurrency(unit.osnovna_zakupnina)
                              : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {unit.nekretnina_naziv || "Nekretnina"} •{" "}
                          {unit.povrsina_m2 ? `${unit.povrsina_m2} m²` : "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Trenutno nema praznih podprostora.
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  Rezervacije i pipeline
                </h4>
                {rentalCapacity.pipeline_units &&
                rentalCapacity.pipeline_units.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rentalCapacity.pipeline_units.map((unit) => (
                      <li
                        key={unit.id}
                        className="rounded-lg border border-border/50 bg-white/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {unit.naziv || unit.oznaka}
                          </span>
                          <span>
                            {unit.osnovna_zakupnina != null
                              ? formatCurrency(unit.osnovna_zakupnina)
                              : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80">
                          {unit.nekretnina_naziv || "Nekretnina"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nema rezerviranih podprostora u pipelineu.
                  </p>
                )}
              </div>
            </div>

            {rentalCapacity.by_property &&
              rentalCapacity.by_property.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Popunjenost po nekretninama
                  </h4>
                  <div className="space-y-2">
                    {rentalCapacity.by_property.slice(0, 5).map((row) => (
                      <div
                        key={row.nekretnina_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-white/70 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {row.naziv || "Nekretnina"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.iznajmljeno}/{row.ukupno} jedinica •{" "}
                            {row.popunjenost != null
                              ? formatPercentage(row.popunjenost)
                              : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(100, Math.max(0, row.popunjenost ?? 0))}%`,
                              }}
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
              <CardTitle className="text-lg font-semibold">
                Segmenti portfelja
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sumarni pogled po vrsti nekretnine s vrijednošću, prinosom i
                popunjenošću.
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
                      <tr
                        key={row.type}
                        className="transition hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatPropertyType(row.type)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.count}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatArea(row.total_area)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatCurrency(row.total_value)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatCurrency(row.net_income)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.average_occupancy !== null
                            ? formatPercentage(row.average_occupancy)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {margin !== null
                            ? formatDeltaPercentage(margin)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {maintenanceKpi && (
        <Card className="shadow-shell" data-testid="maintenance-kpi-card">
          <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                KPI održavanja
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Praćenje radnih naloga, SLA i troškova.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/5 text-primary"
            >
              {maintenanceKpi.open_workorders} otvorenih naloga
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                Otvoreni nalozi
              </p>
              <p className="text-lg font-semibold text-foreground">
                {maintenanceKpi.open_workorders}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                Nalozi u kašnjenju
              </p>
              <p className="text-lg font-semibold text-foreground">
                {maintenanceKpi.overdue_workorders}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                Prosječno vrijeme rješavanja
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatHours(maintenanceKpi.avg_resolution_hours)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                Procijenjeni trošak
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(maintenanceKpi.estimated_cost_total)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                Stvarni trošak
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(maintenanceKpi.actual_cost_total)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-xs text-muted-foreground uppercase">
                SLA prekoračenja
              </p>
              <p className="text-lg font-semibold text-foreground">
                {maintenanceKpi.sla_breaches}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <section id="podsjetnici" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">
            Podsjećanja
          </h2>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {activeRemindersCount} aktivnih
          </Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Aktivna podsjećanja
              </CardTitle>
              <Bell className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {activeRemindersCount > 0 ? (
                <div className="space-y-3">
                  {upcomingReminders.map((reminder) => (
                    <ClickableReminder
                      key={reminder.id}
                      podsjetnik={reminder}
                    />
                  ))}
                  {activeRemindersCount > upcomingReminders.length && (
                    <p className="text-xs text-muted-foreground/80">
                      Prikazano prvih {upcomingReminders.length} aktivnih
                      podsjećanja.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/80">
                  Trenutno nema aktivnih podsjećanja.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Statistika podsjećanja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Ukupno podsjećanja</span>
                    <span className="font-semibold text-foreground">
                      {totalReminders}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aktivna</span>
                    <span className="font-semibold text-orange-600">
                      {activeRemindersCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Poslana</span>
                    <span className="font-semibold text-green-600">
                      {sentRemindersCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Visok prioritet (≤30 dana)</span>
                    <span className="font-semibold text-red-600">
                      {highPriorityCount}
                    </span>
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
                <CardTitle className="text-lg font-semibold">
                  Sljedeći rokovi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingReminders.length > 0 ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {upcomingReminders.map((reminder) => {
                      const { contract, property, tenant } =
                        getReminderContext(reminder);
                      return (
                        <div
                          key={reminder.id}
                          className="border-l-4 border-blue-500 pl-3"
                        >
                          <p className="font-medium text-foreground">
                            {getReminderLabel(reminder.tip)}
                          </p>
                          {contract && (
                            <p className="text-xs text-muted-foreground">
                              Ugovor: {contract.interna_oznaka}
                            </p>
                          )}
                          {(property || tenant) && (
                            <p className="text-xs text-muted-foreground/80">
                              {(property && property.naziv) ||
                                "Nepoznata nekretnina"}{" "}
                              •{" "}
                              {tenant?.naziv_firme ||
                                tenant?.ime_prezime ||
                                "Nepoznat zakupnik"}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/80">
                            {new Date(
                              reminder.datum_podsjetnika,
                            ).toLocaleDateString()}{" "}
                            ({reminder.dani_prije} dana prije)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/80">
                    Nema nadolazećih podsjećanja.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showAllReminders} onOpenChange={setShowAllReminders}>
          <DialogContent
            className="max-w-4xl max-h-[85vh] overflow-y-auto"
            aria-describedby="sva-podsjetnici-opis"
          >
            <DialogHeader>
              <DialogTitle>
                Podsjećanja ({filteredAllReminders.length}/{totalReminders})
              </DialogTitle>
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
                    { value: "svi", label: "Svi" },
                    { value: "aktivni", label: "Aktivni" },
                    { value: "poslani", label: "Poslani" },
                    { value: "visok", label: "Visok prioritet" },
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={
                        remindersFilter === value ? "default" : "outline"
                      }
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
                  <p className="text-sm text-muted-foreground/80">
                    Nema podsjećanja za zadane filtere.
                  </p>
                ) : (
                  filteredAllReminders.map((reminder) => {
                    const { contract, property, tenant } =
                      getReminderContext(reminder);
                    const isSent = Boolean(reminder.poslan);
                    const isHighPriority =
                      !isSent &&
                      reminder.dani_prije !== undefined &&
                      reminder.dani_prije <= 30;
                    return (
                      <Card
                        key={reminder.id}
                        className="border border-border/60"
                      >
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {getReminderLabel(reminder.tip)}
                            </Badge>
                            {isSent ? (
                              <Badge variant="secondary">Poslano</Badge>
                            ) : isHighPriority ? (
                              <Badge variant="destructive">
                                Visok prioritet
                              </Badge>
                            ) : (
                              <Badge variant="outline">Aktivno</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/80">
                            {reminder.datum_podsjetnika
                              ? new Date(
                                  reminder.datum_podsjetnika,
                                ).toLocaleDateString("hr-HR")
                              : "Nepoznat datum"}
                            {reminder.dani_prije !== undefined &&
                            !Number.isNaN(reminder.dani_prije)
                              ? ` • ${reminder.dani_prije} dana prije`
                              : ""}
                          </p>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground">
                            Ugovor:{" "}
                            {contract?.interna_oznaka || "Nepoznat ugovor"}
                          </p>
                          <p>
                            Nekretnina: {property?.naziv || "—"}
                            {property?.adresa ? ` (${property.adresa})` : ""}
                          </p>
                          <p>
                            Zakupnik:{" "}
                            {tenant?.naziv_firme || tenant?.ime_prezime || "—"}
                            {tenant?.oib ? ` • OIB: ${tenant.oib}` : ""}
                          </p>
                          {reminder.napomena && (
                            <p className="text-xs text-muted-foreground/80">
                              Napomena: {reminder.napomena}
                            </p>
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
  oznaka: "",
  naziv: "",
  kat: "",
  povrsina_m2: "",
  status: "dostupno",
  osnovna_zakupnina: "",
  zakupnik_id: "",
  ugovor_id: "",
  raspolozivo_od: "",
  layout_ref: "",
  napomena: "",
};

const PropertyUnitsPanel = ({
  property,
  units = [],
  tenants = [],
  tenantsById = {},
  contracts = [],
  onRefresh,
}) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [unitFormMode, setUnitFormMode] = useState("create");
  const [unitFormData, setUnitFormData] = useState({ ...DEFAULT_UNIT_FORM });
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitDetailOpen, setUnitDetailOpen] = useState(false);
  const [unitDetailId, setUnitDetailId] = useState(null);
  const [unitDocuments, setUnitDocuments] = useState([]);
  const [unitDocsLoading, setUnitDocsLoading] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    status: "",
    osnovna_zakupnina: "",
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [unitFilter, setUnitFilter] = useState("svi");

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

  const overallSummary = useMemo(() => computeUnitsSummary(units), [units]);
  const contractsById = useMemo(
    () =>
      Object.fromEntries(
        (contracts || []).map((contract) => [contract.id, contract]),
      ),
    [contracts],
  );

  const tenantOptions = useMemo(() => {
    return (tenants || []).slice().sort((a, b) => {
      const labelA = a.naziv_firme || a.ime_prezime || "";
      const labelB = b.naziv_firme || b.ime_prezime || "";
      return labelA.localeCompare(labelB, "hr");
    });
  }, [tenants]);

  const unitStatusOptions = useMemo(
    () =>
      Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    [],
  );

  const filteredUnits = useMemo(() => {
    if (unitFilter === "svi") {
      return units;
    }
    return units.filter((unit) => unit.status === unitFilter);
  }, [units, unitFilter]);

  const allFilteredSelected = useMemo(
    () =>
      filteredUnits.length > 0 &&
      filteredUnits.every((unit) => selectedIds.has(unit.id)),
    [filteredUnits, selectedIds],
  );

  const selectedUnits = useMemo(
    () => filteredUnits.filter((unit) => selectedIds.has(unit.id)),
    [filteredUnits, selectedIds],
  );
  const resolvedUnitDetail = useMemo(() => {
    if (!unitDetailId) {
      return null;
    }
    return units.find((unit) => unit.id === unitDetailId) || null;
  }, [unitDetailId, units]);

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredUnits.map((unit) => unit.id)));
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
    setUnitFormMode("create");
  }, []);

  const openCreateForm = () => {
    resetForm();
    setUnitFormOpen(true);
  };

  const openEditForm = (unit) => {
    setUnitFormMode("edit");
    setUnitFormData({
      id: unit.id,
      oznaka: unit.oznaka || "",
      naziv: unit.naziv || "",
      kat: unit.kat || "",
      povrsina_m2: unit.povrsina_m2 ?? "",
      status: unit.status || "dostupno",
      osnovna_zakupnina: unit.osnovna_zakupnina ?? "",
      zakupnik_id: unit.zakupnik_id || "",
      ugovor_id: unit.ugovor_id || "",
      raspolozivo_od: unit.raspolozivo_od
        ? new Date(unit.raspolozivo_od).toISOString().slice(0, 10)
        : "",
      layout_ref: unit.layout_ref || "",
      napomena: unit.napomena || "",
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
      status: unitFormData.status || "dostupno",
      osnovna_zakupnina:
        unitFormData.osnovna_zakupnina === ""
          ? null
          : parseNumericValue(unitFormData.osnovna_zakupnina),
      zakupnik_id: unitFormData.zakupnik_id || null,
      ugovor_id: unitFormData.ugovor_id || null,
      raspolozivo_od: unitFormData.raspolozivo_od || null,
      layout_ref: unitFormData.layout_ref?.trim() || null,
      napomena: unitFormData.napomena?.trim() || null,
    };

    if (unitFormData.povrsina_m2 !== "") {
      payload.povrsina_m2 = parseNumericValue(unitFormData.povrsina_m2);
    }

    if (!payload.oznaka) {
      throw new Error("Identifikator jedinice je obavezan.");
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
      if (unitFormMode === "create") {
        await api.createUnit(property.id, payload);
        toast.success("Podprostor je dodan.");
      } else if (unitFormData.id) {
        await api.updateUnit(unitFormData.id, payload);
        toast.success("Podprostor je ažuriran.");
      }
      await refreshAndCloseForm();
    } catch (error) {
      console.error("Neuspjelo spremanje jedinice:", error);
      toast.error(error?.message || "Spremanje jedinice nije uspjelo.");
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit) => {
    const confirmed = window.confirm(
      `Obrisati jedinicu "${getUnitDisplayName(unit)}"?`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await api.deleteUnit(unit.id);
      toast.success("Podprostor je obrisan.");
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Neuspjelo brisanje jedinice:", error);
      toast.error(error?.response?.data?.detail || "Brisanje nije uspjelo.");
    }
  };

  const loadUnitDocuments = async (unitId) => {
    setUnitDocsLoading(true);
    try {
      const response = await api.getDokumentiPropertyUnit(unitId);
      setUnitDocuments(response.data || []);
    } catch (error) {
      console.error("Greška pri dohvaćanju dokumenata jedinice:", error);
      setUnitDocuments([]);
      toast.error("Dokumenti jedinice nisu dostupni.");
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
      toast.error("Odaberite podprostore za masovno ažuriranje.");
      return;
    }

    const payload = {};
    if (bulkForm.status) {
      payload.status = bulkForm.status;
    }
    if (bulkForm.osnovna_zakupnina !== "") {
      payload.osnovna_zakupnina = parseNumericValue(bulkForm.osnovna_zakupnina);
    }

    if (!Object.keys(payload).length) {
      toast.error("Navedite barem jednu promjenu za bulk ažuriranje.");
      return;
    }

    try {
      setBulkSubmitting(true);
      await api.bulkUpdateUnits({
        unit_ids: Array.from(selectedIds),
        updates: payload,
      });
      toast.success("Masovno ažuriranje je dovršeno.");
      setBulkDialogOpen(false);
      setBulkForm({ status: "", osnovna_zakupnina: "" });
      setSelectedIds(new Set());
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Neuspjelo masovno ažuriranje:", error);
      toast.error("Masovno ažuriranje nije uspjelo.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const resolveContractLabel = (unit) => {
    if (!unit?.ugovor_id) {
      return "—";
    }
    const contract = contractsById[unit.ugovor_id];
    if (!contract) {
      return "Nepoznat ugovor";
    }
    const statusLabel = contract.status ? contract.status.toString() : "";
    return `${contract.interna_oznaka || "Ugovor"}${statusLabel ? ` (${statusLabel})` : ""}`;
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Pregled podprostora
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ukupno {overallSummary.total} jedinica • {overallSummary.leased}{" "}
                iznajmljeno • {overallSummary.available} dostupno
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Popunjenost:{" "}
              {overallSummary.total
                ? formatPercentage(overallSummary.occupancy)
                : "—"}
            </div>
          </div>

          <UnitStatusMap
            units={units}
            filter={unitFilter}
            onFilterChange={setUnitFilter}
          />

          <Separator className="bg-border/60" />

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} odabranih jedinica`
                : "Odaberite jedinice za bulk radnje"}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" /> Dodaj jedinicu
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedIds.size}
                onClick={() => setBulkDialogOpen(true)}
              >
                <Archive className="mr-2 h-4 w-4" /> Bulk radnje
              </Button>
            </div>
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
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) =>
                      toggleSelectAll(Boolean(checked))
                    }
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
            {filteredUnits.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Nema definiranih podprostora. Dodajte prvu jedinicu koristeći
                  gumb iznad.
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit) => {
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
                          <span className="font-medium text-foreground">
                            {getUnitDisplayName(unit)}
                          </span>
                          {unit.oznaka && unit.naziv && (
                            <span className="text-xs text-muted-foreground">
                              {unit.oznaka}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {unit.kat || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {unit.povrsina_m2 ? `${unit.povrsina_m2} m²` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(unit.status)}`}
                      >
                        {formatUnitStatus(unit.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenantName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {resolveContractLabel(unit)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {unit.osnovna_zakupnina != null
                        ? formatCurrency(unit.osnovna_zakupnina)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {unit.raspolozivo_od
                        ? formatDate(unit.raspolozivo_od)
                        : "—"}
                    </td>
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

      <Dialog
        open={unitFormOpen}
        onOpenChange={(open) => {
          setUnitFormOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {unitFormMode === "create"
                ? "Dodaj podprostor"
                : "Uredi podprostor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit-oznaka">Identifikator *</Label>
                <Input
                  id="unit-oznaka"
                  value={unitFormData.oznaka}
                  onChange={(event) =>
                    handleUnitFormChange("oznaka", event.target.value)
                  }
                  placeholder="npr. A2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-naziv">Naziv</Label>
                <Input
                  id="unit-naziv"
                  value={unitFormData.naziv}
                  onChange={(event) =>
                    handleUnitFormChange("naziv", event.target.value)
                  }
                  placeholder="npr. Ured A2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-kat">Kat / zona</Label>
                <Input
                  id="unit-kat"
                  value={unitFormData.kat}
                  onChange={(event) =>
                    handleUnitFormChange("kat", event.target.value)
                  }
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
                  onChange={(event) =>
                    handleUnitFormChange("povrsina_m2", event.target.value)
                  }
                  placeholder="npr. 120"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={unitFormData.status}
                  onValueChange={(value) =>
                    handleUnitFormChange("status", value)
                  }
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
              <div className="space-y-2">
                <Label htmlFor="unit-rent">Osnovna zakupnina (€)</Label>
                <Input
                  id="unit-rent"
                  type="number"
                  step="0.01"
                  value={unitFormData.osnovna_zakupnina}
                  onChange={(event) =>
                    handleUnitFormChange(
                      "osnovna_zakupnina",
                      event.target.value,
                    )
                  }
                  placeholder="npr. 1500"
                />
              </div>
              <div className="space-y-2">
                <Label>Zakupnik</Label>
                <Select
                  value={unitFormData.zakupnik_id || "none"}
                  onValueChange={(value) =>
                    handleUnitFormChange(
                      "zakupnik_id",
                      value === "none" ? "" : value,
                    )
                  }
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
                  value={unitFormData.ugovor_id || "none"}
                  onValueChange={(value) =>
                    handleUnitFormChange(
                      "ugovor_id",
                      value === "none" ? "" : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Poveži ugovor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez ugovora</SelectItem>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.interna_oznaka} (
                        {formatDate(contract.datum_pocetka)} -{" "}
                        {formatDate(contract.datum_zavrsetka)})
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
                  onChange={(event) =>
                    handleUnitFormChange("raspolozivo_od", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-layout">Pozicija / tlocrt</Label>
                <Input
                  id="unit-layout"
                  value={unitFormData.layout_ref}
                  onChange={(event) =>
                    handleUnitFormChange("layout_ref", event.target.value)
                  }
                  placeholder="npr. Grid A3 ili URL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-notes">Napomena</Label>
              <Textarea
                id="unit-notes"
                value={unitFormData.napomena}
                onChange={(event) =>
                  handleUnitFormChange("napomena", event.target.value)
                }
                placeholder="Interna napomena, posebne upute i sl."
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setUnitFormOpen(false)}
              disabled={unitSubmitting}
            >
              Odustani
            </Button>
            <Button onClick={submitUnitForm} disabled={unitSubmitting}>
              {unitSubmitting ? "Spremanje..." : "Spremi"}
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
              Odabrano je {selectedIds.size} jedinica. Odaberite promjene koje
              želite primijeniti na sve.
            </p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={bulkForm.status || "none"}
                onValueChange={(value) =>
                  setBulkForm((prev) => ({
                    ...prev,
                    status: value === "none" ? "" : value,
                  }))
                }
              >
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
                onChange={(event) =>
                  setBulkForm((prev) => ({
                    ...prev,
                    osnovna_zakupnina: event.target.value,
                  }))
                }
                placeholder="Ostavi prazno za bez promjene"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              disabled={bulkSubmitting}
            >
              Odustani
            </Button>
            <Button onClick={applyBulkUpdates} disabled={bulkSubmitting}>
              {bulkSubmitting ? "Primjena..." : "Primijeni promjene"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unitDetailOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeUnitDetail();
          } else {
            setUnitDetailOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          {resolvedUnitDetail ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{getUnitDisplayName(resolvedUnitDetail)}</span>
                  <Badge
                    className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(resolvedUnitDetail.status)}`}
                  >
                    {formatUnitStatus(resolvedUnitDetail.status)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoField
                  label="Identifikator"
                  value={resolvedUnitDetail.oznaka || "—"}
                />
                <InfoField
                  label="Kat / zona"
                  value={resolvedUnitDetail.kat || "—"}
                />
                <InfoField
                  label="Površina"
                  value={
                    resolvedUnitDetail.povrsina_m2
                      ? `${resolvedUnitDetail.povrsina_m2} m²`
                      : "—"
                  }
                />
                <InfoField
                  label="Osnovna zakupnina"
                  value={
                    resolvedUnitDetail.osnovna_zakupnina != null
                      ? formatCurrency(resolvedUnitDetail.osnovna_zakupnina)
                      : "—"
                  }
                />
                <InfoField
                  label="Zakupnik"
                  value={resolveUnitTenantName(resolvedUnitDetail, tenantsById)}
                />
                <InfoField
                  label="Ugovor"
                  value={resolveContractLabel(resolvedUnitDetail)}
                />
                <InfoField
                  label="Raspoloživo od"
                  value={
                    resolvedUnitDetail.raspolozivo_od
                      ? formatDate(resolvedUnitDetail.raspolozivo_od)
                      : "—"
                  }
                />
                <InfoField
                  label="Pripada nekretnini"
                  value={property?.naziv || "—"}
                />
              </div>

              {resolvedUnitDetail.napomena && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Napomena</p>
                  <p>{resolvedUnitDetail.napomena}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Dokumenti
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditForm(resolvedUnitDetail)}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Uredi jedinicu
                  </Button>
                </div>
                {unitDocsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Učitavanje dokumenata...
                  </p>
                ) : unitDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nema dokumenata povezanih s ovim podprostorom.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {unitDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-white/80 px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {doc.naziv}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {doc.tip} • {formatDate(doc.kreiran)}
                          </span>
                        </div>
                        {doc.putanja_datoteke && (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={buildDocumentUrl(doc)}
                              target="_blank"
                              rel="noreferrer"
                            >
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
            <div className="py-6 text-center text-sm text-muted-foreground">
              Jedinica nije pronađena.
            </div>
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
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [propertySearch, setPropertySearch] = useState("");
  const propertyTypeOptions = useMemo(() => {
    const types = new Set(
      (nekretnine || []).map((item) => item.vrsta).filter(Boolean),
    );
    return Array.from(types);
  }, [nekretnine]);
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const {
    dokumenti,
    ugovori,
    zakupnici,
    propertyUnitsByProperty,
    refresh: refreshEntities,
  } = useEntityStore();
  const navigate = useNavigate();

  const {
    logs: propertyAuditLogs,
    loading: propertyAuditLoading,
    error: propertyAuditError,
  } = useAuditTimeline("property", selectedNekretnina?.id, {
    limit: 25,
    enabled: Boolean(selectedNekretnina?.id),
  });

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
    return Object.fromEntries(
      zakupnici.map((zakupnik) => [zakupnik.id, zakupnik]),
    );
  }, [zakupnici]);

  const unitsSummaryByProperty = useMemo(() => {
    const summaries = {};
    Object.entries(propertyUnitsByProperty || {}).forEach(
      ([propertyId, unitsForProperty]) => {
        summaries[propertyId] = computeUnitsSummary(unitsForProperty || []);
      },
    );
    return summaries;
  }, [propertyUnitsByProperty]);

  const renderPropertyNotes = useCallback((notes) => {
    if (!notes || !notes.trim()) {
      return (
        <p className="text-sm text-muted-foreground/80">
          Nema zabilježenih napomena.
        </p>
      );
    }
    const lines = notes
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
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

  const handleAddValuation = useCallback(
    (property) => {
      if (!property) {
        return;
      }
      sessionStorage.setItem(
        "dokumentPrefill",
        JSON.stringify({
          naziv: `Procjena vrijednosti - ${property.naziv}`,
          tip: "procjena_vrijednosti",
          opis: property.adresa || "",
          nekretnina_id: property.id,
        }),
      );
      navigate(`/dokumenti?tip=procjena_vrijednosti&nekretnina=${property.id}`);
    },
    [navigate],
  );

  const handleViewValuations = useCallback(
    (propertyId) => {
      navigate(`/dokumenti?tip=procjena_vrijednosti&nekretnina=${propertyId}`);
    },
    [navigate],
  );

  useEffect(() => {
    fetchNekretnine();
  }, []);

  const fetchNekretnine = async () => {
    try {
      const response = await api.getNekretnine();
      setNekretnine(response.data);
    } catch (error) {
      console.error("Greška pri dohvaćanju nekretnina:", error);
      toast.error("Greška pri učitavanju nekretnina");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNekretnina = async (formPayload) => {
    if (formSubmitting) {
      return;
    }
    setFormSubmitting(true);
    const { property, units } = normaliseNekretninaPayload(formPayload);
    try {
      const response = await api.createNekretnina(property);
      const createdProperty = response.data;

      setNekretnine((prev) => [createdProperty, ...prev]);
      setShowCreateForm(false);

      if (units && units.length) {
        for (const unitPayload of units) {
          if (!unitPayload.oznaka) {
            continue;
          }
          try {
            await api.createUnit(createdProperty.id, unitPayload);
          } catch (error) {
            console.error("Neuspjelo kreiranje podprostora:", error);
            toast.error(
              `Podprostor ${unitPayload.oznaka} nije kreiran. Pokušajte ga dodati kasnije.`,
            );
          }
        }
      }

      toast.success("Nekretnina je uspješno kreirana");
      await fetchNekretnine();
      try {
        await refreshEntities();
      } catch (refreshError) {
        console.error(
          "Greška pri osvježavanju entiteta nakon kreiranja nekretnine:",
          refreshError,
        );
        toast.warning(
          "Nekretnina je kreirana, ali osvježavanje prikaza nije uspjelo.",
        );
      }
    } catch (error) {
      console.error("Greška pri kreiranju nekretnine:", error);
      toast.error("Greška pri kreiranju nekretnine");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateNekretnina = async (formPayload) => {
    if (!editingNekretnina || formSubmitting) {
      return;
    }
    setFormSubmitting(true);
    const currentId = editingNekretnina.id;
    const { property, units } = normaliseNekretninaPayload(formPayload);
    try {
      await api.updateNekretnina(currentId, property);

      if (units && units.length) {
        const existing = propertyUnitsByProperty?.[currentId] || [];
        const existingByOznaka = new Map(
          existing
            .filter((unit) => unit?.oznaka)
            .map((unit) => [unit.oznaka.trim().toLowerCase(), unit]),
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
            await api.createUnit(currentId, unitPayload);
          } catch (error) {
            console.error("Neuspjelo kreiranje podprostora:", error);
            toast.error(
              `Podprostor ${unitPayload.oznaka} nije kreiran. Pokušajte ga dodati kasnije.`,
            );
          }
        }

        if (duplicates.length) {
          toast.warning(
            `Podprostor${duplicates.length > 1 ? "i" : ""} ${duplicates.join(", ")} već postoji i nije ponovno kreiran.`,
          );
        }
      }

      toast.success("Nekretnina je uspješno ažurirana");
      setEditingNekretnina(null);
      await fetchNekretnine();
      try {
        await refreshEntities();
      } catch (refreshError) {
        console.error(
          "Greška pri osvježavanju entiteta nakon ažuriranja nekretnine:",
          refreshError,
        );
        toast.warning(
          "Nekretnina je ažurirana, ali prikaz podataka nije osvježen.",
        );
      }
    } catch (error) {
      console.error("Greška pri ažuriranju nekretnine:", error);
      toast.error("Greška pri ažuriranju nekretnine");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteNekretnina = async (nekretnina_id) => {
    if (window.confirm("Jeste li sigurni da želite obrisati ovu nekretninu?")) {
      try {
        await api.deleteNekretnina(nekretnina_id);
        toast.success("Nekretnina je uspješno obrisana");
        fetchNekretnine();
        await refreshEntities();
      } catch (error) {
        console.error("Greška pri brisanju nekretnine:", error);
        toast.error("Greška pri brisanju nekretnine");
      }
    }
  };

  const handleDownloadDokument = (dokument) => {
    if (!dokument.putanja_datoteke) {
      toast.error("PDF nije dostupan za ovaj dokument");
      return;
    }
    const url = `${BACKEND_URL}/${dokument.putanja_datoteke}`;
    window.open(url, "_blank", "noopener");
  };

  const generatePropertyReport = async (nekretnina) => {
    try {
      toast.info("Generiranje PDF analize...");

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("ANALIZA NEKRETNINE", 105, 20, { align: "center" });

      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("OSNOVNI PODACI", 20, 40);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
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
      doc.setFont("helvetica", "bold");
      doc.text("VLASNIŠTVO", 20, 115);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Vlasnik: ${nekretnina.vlasnik || "N/A"}`, 20, 125);
      doc.text(
        `Udio vlasništva: ${nekretnina.udio_vlasnistva || "N/A"}`,
        20,
        133,
      );

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("FINANCIJSKA ANALIZA", 20, 150);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
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
          const percentage =
            nabavna !== 0 ? ((difference / nabavna) * 100).toFixed(2) : "0.00";
          doc.text(
            `Promjena vrijednosti: ${formatCurrency(difference)} (${percentage}%)`,
            20,
            yPos,
          );
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
        doc.setFont("helvetica", "bold");
        doc.text("ODRŽAVANJE", 20, yPos + 10);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        yPos += 22;

        if (nekretnina.zadnja_obnova) {
          doc.text(`Zadnja obnova: ${nekretnina.zadnja_obnova}`, 20, yPos);
          yPos += 8;
        }
        if (nekretnina.potrebna_ulaganja) {
          const ulaganja = doc.splitTextToSize(
            `Potrebna ulaganja: ${nekretnina.potrebna_ulaganja}`,
            170,
          );
          doc.text(ulaganja, 20, yPos);
          yPos += ulaganja.length * 6 + 4;
        }
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RIZICI", 20, yPos + 10);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      yPos += 22;

      if (nekretnina.sudski_sporovi) {
        const sporovi = doc.splitTextToSize(
          `Sudski sporovi: ${nekretnina.sudski_sporovi}`,
          170,
        );
        doc.text(sporovi, 20, yPos);
        yPos += sporovi.length * 6 + 4;
      }
      if (nekretnina.hipoteke) {
        const hipoteke = doc.splitTextToSize(
          `Hipoteka: ${nekretnina.hipoteke}`,
          170,
        );
        doc.text(hipoteke, 20, yPos);
        yPos += hipoteke.length * 6 + 4;
      }
      if (nekretnina.napomene) {
        const napomene = doc.splitTextToSize(
          `Napomene upravitelja: ${nekretnina.napomene}`,
          170,
        );
        doc.text(napomene, 20, yPos);
        yPos += napomene.length * 6 + 4;
      }

      const fileName = `Nekretnina_${nekretnina.naziv.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast.success(
        `PDF analiza za ${nekretnina.naziv} je uspješno generirana`,
      );
    } catch (error) {
      console.error("Greška pri generiranju PDF analize:", error);
      toast.error("Greška pri generiranju PDF analize");
    }
  };

  const renderContractStatusBadge = (status) => {
    const statusMap = {
      aktivno: { label: "Aktivno", variant: "default" },
      na_isteku: { label: "Na isteku", variant: "secondary" },
      raskinuto: { label: "Raskinuto", variant: "destructive" },
      arhivirano: { label: "Arhivirano", variant: "outline" },
    };
    const info = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const computeRoi = (nekretnina) => {
    const neto = parseNumericValue(nekretnina.proslogodisnji_neto_prihod);
    const osnova =
      parseNumericValue(nekretnina.nabavna_cijena) ||
      parseNumericValue(nekretnina.trzisna_vrijednost);
    if (neto === null || osnova === null || osnova === 0) {
      return null;
    }
    return (neto / osnova) * 100;
  };

  const getRiskBadges = (nekretnina) => {
    if (!nekretnina) {
      return [];
    }

    const badges = [];
    const hasMeaningfulValue = (value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          return false;
        }
        const normalised = trimmed.toLowerCase();
        const neutralKeywords = [
          "nema",
          "bez",
          "nije evidentirano",
          "nije dostupno",
          "n/a",
        ];
        if (
          neutralKeywords.some(
            (keyword) =>
              normalised === keyword ||
              normalised.startsWith(`${keyword} `) ||
              normalised.endsWith(` ${keyword}`),
          ) ||
          normalised === "-" ||
          normalised === "—"
        ) {
          return false;
        }
        return true;
      }
      if (typeof value === "number") {
        return !Number.isNaN(value) && value !== 0;
      }
      return true;
    };

    if (hasMeaningfulValue(nekretnina.sudski_sporovi)) {
      badges.push({ label: "Sudski sporovi", variant: "destructive" });
    }

    if (hasMeaningfulValue(nekretnina.hipoteke)) {
      badges.push({ label: "Hipoteka", variant: "destructive" });
    }

    if (hasMeaningfulValue(nekretnina.potrebna_ulaganja)) {
      badges.push({ label: "Potrebna ulaganja", variant: "secondary" });
    }

    if (hasMeaningfulValue(nekretnina.napomene)) {
      badges.push({ label: "Napomena upravitelja", variant: "outline" });
    }

    const netIncome = parseNumericValue(nekretnina.proslogodisnji_neto_prihod);
    if (typeof netIncome === "number" && netIncome < 0) {
      badges.push({ label: "Negativan neto prihod", variant: "destructive" });
    }

    const grossIncome = parseNumericValue(nekretnina.prosllogodisnji_prihodi);
    const operatingExpense = parseNumericValue(
      nekretnina.prosllogodisnji_rashodi,
    );
    if (
      grossIncome !== null &&
      operatingExpense !== null &&
      grossIncome < operatingExpense
    ) {
      badges.push({ label: "Rashodi veći od prihoda", variant: "secondary" });
    }

    return badges;
  };

  const filteredProperties = useMemo(() => {
    const search = propertySearch.trim().toLowerCase();

    return nekretnine.filter((property) => {
      if (search) {
        const haystack =
          `${property.naziv || ""} ${property.adresa || ""}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (typeFilter !== "all" && property.vrsta !== typeFilter) {
        return false;
      }

      const riskCount = getRiskBadges(property).length;
      if (riskFilter === "risk" && riskCount === 0) {
        return false;
      }
      if (riskFilter === "clear" && riskCount > 0) {
        return false;
      }

      return true;
    });
  }, [nekretnine, propertySearch, typeFilter, riskFilter]);

  const {
    totalArea,
    averageOccupancy,
    totalValue,
    totalGrossIncome,
    totalOperatingExpense,
    totalNetIncome,
    averageRoi,
  } = useMemo(() => {
    if (!filteredProperties.length) {
      return {
        totalArea: 0,
        averageOccupancy: null,
        totalValue: 0,
        totalGrossIncome: 0,
        totalOperatingExpense: 0,
        totalNetIncome: 0,
        averageRoi: null,
      };
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

      const grossIncome =
        parseNumericValue(property.prosllogodisnji_prihodi) || 0;
      const operatingExpense =
        parseNumericValue(property.prosllogodisnji_rashodi) || 0;
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
        const active = contracts.filter((c) => c.status === "aktivno").length;
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

    const grossIncome =
      parseNumericValue(selectedNekretnina.prosllogodisnji_prihodi) || 0;
    const operatingExpense =
      parseNumericValue(selectedNekretnina.prosllogodisnji_rashodi) || 0;
    const netIncomeRaw = parseNumericValue(
      selectedNekretnina.proslogodisnji_neto_prihod,
    );
    const netIncome =
      netIncomeRaw !== null ? netIncomeRaw : grossIncome - operatingExpense;
    const maintenanceCost =
      parseNumericValue(selectedNekretnina.troskovi_odrzavanja) || 0;
    const amortization =
      parseNumericValue(selectedNekretnina.amortizacija) || 0;
    const investmentBase =
      parseNumericValue(selectedNekretnina.nabavna_cijena) ||
      parseNumericValue(selectedNekretnina.trzisna_vrijednost) ||
      null;
    const roiValue = computeRoi(selectedNekretnina);
    const margin = grossIncome
      ? (netIncome / Math.abs(grossIncome)) * 100
      : null;
    const paybackYears =
      netIncome > 0 && investmentBase ? investmentBase / netIncome : null;

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
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            Portfelj nekretnina
          </h1>
          <p className="text-sm text-muted-foreground">
            Pregledajte status, ugovore i ulaganja za svaku imovinu te
            aktivirajte AI analitiku kada treba reakcija.
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ukupna površina
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatArea(totalArea)}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              Portfolio
            </Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prosječna popunjenost
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {averageOccupancy !== null
                  ? formatPercentage(averageOccupancy)
                  : "—"}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              Leasing
            </Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Procijenjena vrijednost
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(totalValue)}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              Valuacija
            </Badge>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Neto prihod (12M)
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(totalNetIncome)}
              </p>
              <p className="text-xs text-muted-foreground">
                Prosječni ROI:{" "}
                {averageRoi !== null ? formatPercentage(averageRoi) : "—"}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">
              Profit
            </Badge>
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
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rizik
            </span>
            <div className="flex gap-2">
              <Button
                variant={riskFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setRiskFilter("all")}
              >
                Sve
              </Button>
              <Button
                variant={riskFilter === "risk" ? "default" : "outline"}
                size="sm"
                onClick={() => setRiskFilter("risk")}
              >
                Sa rizikom
              </Button>
              <Button
                variant={riskFilter === "clear" ? "default" : "outline"}
                size="sm"
                onClick={() => setRiskFilter("clear")}
              >
                Bez rizika
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vrsta
            </span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] text-left">
                <SelectValue placeholder="Sve vrste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve vrste</SelectItem>
                {propertyTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatPropertyType(type)}
                  </SelectItem>
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
          const activeContracts = propertyContracts.filter(
            (ugovor) => ugovor.status === "aktivno",
          );
          const expiringContracts = propertyContracts.filter(
            (ugovor) =>
              ugovor.status === "aktivno" && isContractExpiring(ugovor),
          );
          const occupancy = propertyContracts.length
            ? (activeContracts.length / propertyContracts.length) * 100
            : null;
          const propertyUnitsForCard =
            propertyUnitsByProperty[nekretnina.id] || [];
          const unitsSummary = unitsSummaryByProperty[nekretnina.id];
          const hasUnits = Boolean(unitsSummary && unitsSummary.total);
          const unitOccupancyValue = hasUnits ? unitsSummary.occupancy : null;
          const unitOccupancyLabel = hasUnits
            ? formatPercentage(unitsSummary.occupancy)
            : "—";
          const unitLeasedLabel = hasUnits
            ? `${unitsSummary.leased}/${unitsSummary.total}`
            : null;
          const unitAvailableCount = hasUnits ? unitsSummary.available : null;
          const unitReservedCount = hasUnits ? unitsSummary.reserved : null;
          const unitStatusBreakdown = hasUnits
            ? [
                { status: "iznajmljeno", count: unitsSummary.leased },
                { status: "rezervirano", count: unitsSummary.reserved },
                { status: "dostupno", count: unitsSummary.available },
              ]
            : [];
          const roi = computeRoi(nekretnina);
          const riskBadges = getRiskBadges(nekretnina);
          const activeSummary = propertyContracts.length
            ? `${activeContracts.length}/${propertyContracts.length}`
            : "0";
          const grossIncome =
            parseNumericValue(nekretnina.prosllogodisnji_prihodi) || 0;
          const operatingExpense =
            parseNumericValue(nekretnina.prosllogodisnji_rashodi) || 0;
          const netIncomeRaw = parseNumericValue(
            nekretnina.proslogodisnji_neto_prihod,
          );
          const resolvedNetIncome =
            netIncomeRaw !== null
              ? netIncomeRaw
              : grossIncome - operatingExpense;
          const margin = grossIncome
            ? (resolvedNetIncome / Math.abs(grossIncome)) * 100
            : null;
          const investmentBase =
            parseNumericValue(nekretnina.nabavna_cijena) ||
            parseNumericValue(nekretnina.trzisna_vrijednost) ||
            null;
          const paybackYears =
            resolvedNetIncome > 0 && investmentBase
              ? investmentBase / resolvedNetIncome
              : null;

          return (
            <Card
              key={nekretnina.id}
              data-testid={`nekretnina-card-${nekretnina.id}`}
              className="card-hover border border-border/60 shadow-shell"
            >
              <CardHeader className="border-b border-border/60 bg-primary/5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {nekretnina.naziv}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/30 bg-white/70 text-[11px] uppercase tracking-[0.18em] text-primary"
                      >
                        {formatPropertyType(nekretnina.vrsta)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {nekretnina.adresa}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                      KO {nekretnina.katastarska_opcina} • Čestica{" "}
                      {nekretnina.broj_kat_cestice}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {hasUnits && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <span>Jedinice</span>
                          <span className="font-semibold text-foreground">
                            {unitLeasedLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(100, Math.max(0, unitOccupancyValue || 0))}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {unitOccupancyLabel}
                          </span>
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
                        <Badge
                          key={badge.label}
                          variant={badge.variant}
                          className="rounded-full uppercase text-[11px]"
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <InfoField
                    label="Površina"
                    value={formatArea(nekretnina.povrsina)}
                  />
                  <InfoField
                    label="Godina izgradnje"
                    value={nekretnina.godina_izgradnje || "—"}
                  />
                  <InfoField
                    label="Vlasnik"
                    value={nekretnina.vlasnik || "—"}
                  />
                  <InfoField
                    label="Udio vlasništva"
                    value={nekretnina.udio_vlasnistva || "—"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 xl:grid-cols-4">
                  <InfoField
                    label="Jedinice (iznajmljeno / ukupno)"
                    value={hasUnits ? unitLeasedLabel : "—"}
                  />
                  <InfoField
                    label="Popunjenost (jedinice)"
                    value={hasUnits ? unitOccupancyLabel : "—"}
                  />
                  <InfoField
                    label="Dostupni podprostori"
                    value={hasUnits ? unitAvailableCount : "—"}
                  />
                  <InfoField
                    label="Rezervirano"
                    value={hasUnits ? unitReservedCount : "—"}
                  />
                  <InfoField label="Aktivni ugovori" value={activeSummary} />
                  <InfoField
                    label="Popunjenost (ugovori)"
                    value={
                      occupancy !== null ? formatPercentage(occupancy) : "—"
                    }
                  />
                  <InfoField
                    label="Ugovori na isteku"
                    value={expiringContracts.length || "0"}
                  />
                  <InfoField
                    label="Dokumenti"
                    value={propertyDocuments.length || "0"}
                  />
                  <InfoField
                    label="Tržišna vrijednost"
                    value={formatCurrency(nekretnina.trzisna_vrijednost)}
                  />
                  <InfoField
                    label="ROI (neto / investicija)"
                    value={roi !== null ? formatPercentage(roi) : "—"}
                  />
                  <InfoField
                    label="Period povrata"
                    value={
                      paybackYears ? `${paybackYears.toFixed(1)} god.` : "—"
                    }
                  />
                  <InfoField
                    label="Zadnja obnova"
                    value={formatDate(nekretnina.zadnja_obnova)}
                  />
                </div>

                {(grossIncome || operatingExpense || resolvedNetIncome) && (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-white/60 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Financijski presjek (posljednjih 12 mjeseci)
                      </p>
                      {margin !== null && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${margin >= 0 ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600"}`}
                        >
                          Marža: {formatDeltaPercentage(margin)}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Prihodi
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(grossIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Operativni troškovi
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(operatingExpense)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Neto rezultat
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(resolvedNetIncome)}
                        </p>
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
                            style={{
                              width: `${Math.min(100, Math.max(0, (operatingExpense / grossIncome) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {paybackYears && (
                      <p className="text-xs text-muted-foreground">
                        Procijenjeni period povrata investicije:{" "}
                        {paybackYears.toFixed(1)} godina
                      </p>
                    )}
                  </div>
                )}

                {nekretnina.potrebna_ulaganja && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                    <p className="text-xs uppercase text-amber-600 font-semibold">
                      Planirana ulaganja
                    </p>
                    <p className="text-sm text-amber-800">
                      {nekretnina.potrebna_ulaganja}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-border/40 bg-primary/5">
                <div className="text-xs text-muted-foreground/80">
                  Posljednje ažuriranje:{" "}
                  {formatDate(
                    nekretnina.updated_at ||
                      nekretnina.kreiran ||
                      nekretnina.azuriran,
                  )}
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

      <Dialog
        open={!!selectedNekretnina}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNekretnina(null);
          }
        }}
      >
        {selectedNekretnina && (
          <DialogContent
            className="max-w-5xl max-h-[90vh] overflow-y-auto"
            aria-describedby="nekretnina-details-description"
          >
            <DialogHeader>
              <DialogTitle className="flex flex-col gap-1">
                <span className="text-2xl font-semibold text-foreground">
                  {selectedNekretnina.naziv}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedNekretnina.adresa}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div id="nekretnina-details-description" className="sr-only">
              Detaljan pregled podataka o nekretnini, financija, dokumentacije i
              rizika
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
                <TabsTrigger value="overview">Pregled</TabsTrigger>
                <TabsTrigger value="units">Podprostori</TabsTrigger>
                <TabsTrigger value="financije">Financije</TabsTrigger>
                <TabsTrigger value="dokumenti">Dokumenti</TabsTrigger>
                <TabsTrigger value="ugovori">
                  Ugovori &amp; zakupnici
                </TabsTrigger>
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
                      <InfoField
                        label="Naziv"
                        value={selectedNekretnina.naziv}
                      />
                      <InfoField
                        label="Lokacija"
                        value={selectedNekretnina.adresa}
                      />
                      <InfoField
                        label="Vrsta"
                        value={formatPropertyType(selectedNekretnina.vrsta)}
                      />
                      <InfoField
                        label="Površina"
                        value={formatArea(selectedNekretnina.povrsina)}
                      />
                      <InfoField
                        label="Godina izgradnje"
                        value={selectedNekretnina.godina_izgradnje || "—"}
                      />
                      <InfoField
                        label="Katastarska općina"
                        value={selectedNekretnina.katastarska_opcina || "—"}
                      />
                      <InfoField
                        label="Čestica"
                        value={selectedNekretnina.broj_kat_cestice || "—"}
                      />
                      <InfoField
                        label="Osiguranje"
                        value={selectedNekretnina.osiguranje || "—"}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dokumentacija</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField
                        label="Zemljišnoknjižni izvadak"
                        value={formatBooleanish(
                          selectedNekretnina.zemljisnoknjizni_izvadak,
                        )}
                      />
                      <InfoField
                        label="Uporabna dozvola"
                        value={formatBooleanish(
                          selectedNekretnina.uporabna_dozvola,
                        )}
                      />
                      <InfoField
                        label="Građevinska dozvola"
                        value={formatBooleanish(
                          selectedNekretnina.gradevinska_dozvola,
                        )}
                      />
                      <InfoField
                        label="Energetski certifikat"
                        value={formatBooleanish(
                          selectedNekretnina.energetski_certifikat,
                        )}
                      />
                      <InfoField
                        label="Ostala dokumentacija"
                        value={selectedNekretnina.ostala_dokumentacija || "—"}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="space-y-2">
                    <CardTitle>Napomene i brojila</CardTitle>
                    <p className="text-xs text-muted-foreground/80">
                      Detalji za terenska očitanja, pristupne kodove, serijske
                      brojeve brojila i sve ostale operativne napomene.
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
                  units={sortUnitsByPosition(
                    propertyUnitsByProperty[selectedNekretnina.id] || [],
                  )}
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
                      <InfoField
                        label="Tržišna vrijednost"
                        value={formatCurrency(
                          selectedNekretnina.trzisna_vrijednost,
                        )}
                      />
                      <InfoField
                        label="Nabavna cijena"
                        value={formatCurrency(
                          selectedNekretnina.nabavna_cijena,
                        )}
                      />
                      <InfoField
                        label="Prihodi (12M)"
                        value={formatCurrency(
                          selectedNekretnina.prosllogodisnji_prihodi,
                        )}
                      />
                      <InfoField
                        label="Troškovi (12M)"
                        value={formatCurrency(
                          selectedNekretnina.prosllogodisnji_rashodi,
                        )}
                      />
                      <InfoField
                        label="Amortizacija"
                        value={formatCurrency(selectedNekretnina.amortizacija)}
                      />
                      <InfoField
                        label="Neto prihod (12M)"
                        value={formatCurrency(
                          selectedNekretnina.proslogodisnji_neto_prihod,
                        )}
                      />
                      <InfoField
                        label="Trošak održavanja"
                        value={formatCurrency(
                          selectedNekretnina.troskovi_odrzavanja,
                        )}
                      />
                      <InfoField
                        label="ROI"
                        value={(() => {
                          const roiValue = computeRoi(selectedNekretnina);
                          return roiValue !== null
                            ? formatPercentage(roiValue)
                            : "—";
                        })()}
                      />
                      <InfoField
                        label="Period povrata"
                        value={
                          selectedFinancials?.paybackYears
                            ? `${selectedFinancials.paybackYears.toFixed(1)} god.`
                            : "—"
                        }
                      />
                    </div>

                    {selectedFinancials && (
                      <div className="mt-6 space-y-4 rounded-xl border border-border/60 bg-white/60 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Struktura rezultata
                          </p>
                          {selectedFinancials.margin !== null && (
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${selectedFinancials.margin >= 0 ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600"}`}
                            >
                              Marža:{" "}
                              {formatDeltaPercentage(selectedFinancials.margin)}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Prihodi
                            </p>
                            <p className="text-lg font-semibold text-foreground">
                              {formatCurrency(selectedFinancials.grossIncome)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Operativni troškovi
                            </p>
                            <p className="text-lg font-semibold text-foreground">
                              {formatCurrency(
                                selectedFinancials.operatingExpense,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Neto rezultat
                            </p>
                            <p className="text-lg font-semibold text-foreground">
                              {formatCurrency(selectedFinancials.netIncome)}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Održavanje
                            </p>
                            <p className="text-base font-medium text-foreground">
                              {formatCurrency(
                                selectedFinancials.maintenanceCost,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Amortizacija
                            </p>
                            <p className="text-base font-medium text-foreground">
                              {formatCurrency(selectedFinancials.amortization)}
                            </p>
                          </div>
                        </div>
                        {selectedFinancials.grossIncome > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Udio troškova u prihodima</span>
                              <span>
                                {formatDeltaPercentage(
                                  (selectedFinancials.operatingExpense /
                                    selectedFinancials.grossIncome) *
                                    100,
                                )}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/80"
                                style={{
                                  width: `${Math.min(100, Math.max(0, (selectedFinancials.operatingExpense / selectedFinancials.grossIncome) * 100))}%`,
                                }}
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
                    {(documentsByProperty[selectedNekretnina.id] || [])
                      .length === 0 ? (
                      <p className="text-sm text-muted-foreground/80">
                        Nema povezanih dokumenata. Dodajte ih iz modula
                        Dokumenti.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(documentsByProperty[selectedNekretnina.id] || []).map(
                          (doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {doc.naziv}
                                </p>
                                <p className="text-xs text-muted-foreground/80">
                                  {formatDocumentType(doc.tip)} •{" "}
                                  {formatDate(doc.kreiran)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadDokument(doc)}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Otvori
                                </Button>
                              </div>
                            </div>
                          ),
                        )}
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
                    {(contractsByProperty[selectedNekretnina.id] || [])
                      .length === 0 ? (
                      <div className="space-y-3 text-sm text-muted-foreground/80">
                        <p>Još nema ugovora povezanih s ovom nekretninom.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedNekretnina(null);
                            navigate("/ugovori");
                          }}
                        >
                          Kreiraj ugovor
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(contractsByProperty[selectedNekretnina.id] || []).map(
                          (ugovor) => {
                            const zakupnik = tenantsById[ugovor.zakupnik_id];
                            return (
                              <div
                                key={ugovor.id}
                                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                              >
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">
                                    {ugovor.interna_oznaka}
                                  </p>
                                  <p className="text-xs text-muted-foreground/80">
                                    {formatDate(ugovor.datum_pocetka)} —{" "}
                                    {formatDate(ugovor.datum_zavrsetka)}
                                  </p>
                                  <p className="text-xs text-muted-foreground/80">
                                    Zakupnik:{" "}
                                    {zakupnik?.naziv_firme ||
                                      zakupnik?.ime_prezime ||
                                      "Nepoznat zakupnik"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {renderContractStatusBadge(ugovor.status)}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/ugovori?highlight=${ugovor.id}`,
                                      )
                                    }
                                  >
                                    Detalji
                                  </Button>
                                </div>
                              </div>
                            );
                          },
                        )}
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
                      <InfoField
                        label="Zadnja obnova"
                        value={formatDate(selectedNekretnina.zadnja_obnova)}
                      />
                      <InfoField
                        label="Planirana ulaganja"
                        value={selectedNekretnina.potrebna_ulaganja || "—"}
                      />
                      <InfoField
                        label="Trošak održavanja"
                        value={formatCurrency(
                          selectedNekretnina.troskovi_odrzavanja,
                        )}
                      />
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
                      <InfoField
                        label="Sudski sporovi"
                        value={selectedNekretnina.sudski_sporovi || "—"}
                      />
                      <InfoField
                        label="Hipoteke"
                        value={selectedNekretnina.hipoteke || "—"}
                      />
                    </div>
                    <div className="border border-border/60 rounded-md p-3 bg-primary/5 text-sm text-muted-foreground">
                      <p>Napomena upravitelja:</p>
                      <p className="mt-1 text-foreground">
                        {selectedNekretnina.napomene ||
                          "Nema dodatnih napomena."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <AuditTimelinePanel
              className="mt-6 border-t border-border/60 pt-4"
              title="Audit zapisi"
              logs={propertyAuditLogs}
              loading={propertyAuditLoading}
              error={propertyAuditError}
              emptyMessage="Nema audit zapisa za ovu nekretninu."
            />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="nekretnina-form-description"
        >
          <DialogHeader>
            <DialogTitle>Dodaj novu nekretninu</DialogTitle>
          </DialogHeader>
          <div id="nekretnina-form-description" className="sr-only">
            Forma za kreiranje nove nekretnine s osnovnim informacijama
          </div>
          <NekretninarForm
            onSubmit={handleCreateNekretnina}
            onCancel={() => setShowCreateForm(false)}
            submitting={formSubmitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingNekretnina}
        onOpenChange={() => setEditingNekretnina(null)}
      >
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="uredi-nekretninu-form-description"
        >
          <DialogHeader>
            <DialogTitle>Uredi nekretninu</DialogTitle>
          </DialogHeader>
          <div id="uredi-nekretninu-form-description" className="sr-only">
            Forma za uređivanje postojeće nekretnine
          </div>
          <NekretninarForm
            nekretnina={editingNekretnina}
            existingUnits={
              editingNekretnina
                ? propertyUnitsByProperty?.[editingNekretnina.id] || []
                : []
            }
            onSubmit={handleUpdateNekretnina}
            onCancel={() => setEditingNekretnina(null)}
            submitting={formSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Nekretnina Form Component
const NekretninarForm = ({
  nekretnina,
  onSubmit,
  onCancel,
  existingUnits = [],
  submitting = false,
}) => {
  const [formData, setFormData] = useState({
    naziv: nekretnina?.naziv || "",
    adresa: nekretnina?.adresa || "",
    katastarska_opcina: nekretnina?.katastarska_opcina || "",
    broj_kat_cestice: nekretnina?.broj_kat_cestice || "",
    vrsta: nekretnina?.vrsta || "stan",
    povrsina: nekretnina?.povrsina || "",
    godina_izgradnje: nekretnina?.godina_izgradnje || "",
    vlasnik: nekretnina?.vlasnik || "",
    udio_vlasnistva: nekretnina?.udio_vlasnistva || "",
    nabavna_cijena: nekretnina?.nabavna_cijena || "",
    trzisna_vrijednost: nekretnina?.trzisna_vrijednost || "",
    prosllogodisnji_prihodi: nekretnina?.prosllogodisnji_prihodi || "",
    prosllogodisnji_rashodi: nekretnina?.prosllogodisnji_rashodi || "",
    amortizacija: nekretnina?.amortizacija || "",
    proslogodisnji_neto_prihod: nekretnina?.proslogodisnji_neto_prihod || "",
    zadnja_obnova: nekretnina?.zadnja_obnova || "",
    potrebna_ulaganja: nekretnina?.potrebna_ulaganja || "",
    troskovi_odrzavanja: nekretnina?.troskovi_odrzavanja || "",
    osiguranje: nekretnina?.osiguranje || "",
    sudski_sporovi: nekretnina?.sudski_sporovi || "",
    hipoteke: nekretnina?.hipoteke || "",
    napomene: nekretnina?.napomene || "",
  });
  const [unitsDraft, setUnitsDraft] = useState([]);
  const isEditing = Boolean(nekretnina);
  const unitStatusOptions = useMemo(
    () =>
      Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    [],
  );
  const existingUnitsList = useMemo(
    () => sortUnitsByPosition(existingUnits || []),
    [existingUnits],
  );

  const createDraftUnit = () => ({
    localId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `unit-${Date.now()}-${Math.random()}`,
    oznaka: "",
    naziv: "",
    kat: "",
    povrsina_m2: "",
    status: "dostupno",
    osnovna_zakupnina: "",
    napomena: "",
  });

  const handleAddUnitDraft = () => {
    setUnitsDraft((prev) => [...prev, createDraftUnit()]);
  };

  const handleRemoveUnitDraft = (unitId) => {
    setUnitsDraft((prev) => prev.filter((unit) => unit.localId !== unitId));
  };

  const handleUpdateUnitDraft = (unitId, field, value) => {
    setUnitsDraft((prev) =>
      prev.map((unit) =>
        unit.localId === unitId ? { ...unit, [field]: value } : unit,
      ),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    const data = {
      ...formData,
      povrsina: parseFloat(formData.povrsina) || 0,
      godina_izgradnje: formData.godina_izgradnje
        ? parseInt(formData.godina_izgradnje)
        : null,
      nabavna_cijena: formData.nabavna_cijena
        ? parseFloat(formData.nabavna_cijena)
        : null,
      trzisna_vrijednost: formData.trzisna_vrijednost
        ? parseFloat(formData.trzisna_vrijednost)
        : null,
      prosllogodisnji_prihodi: formData.prosllogodisnji_prihodi
        ? parseFloat(formData.prosllogodisnji_prihodi)
        : null,
      prosllogodisnji_rashodi: formData.prosllogodisnji_rashodi
        ? parseFloat(formData.prosllogodisnji_rashodi)
        : null,
      amortizacija: formData.amortizacija
        ? parseFloat(formData.amortizacija)
        : null,
      proslogodisnji_neto_prihod: formData.proslogodisnji_neto_prihod
        ? parseFloat(formData.proslogodisnji_neto_prihod)
        : null,
      troskovi_odrzavanja: formData.troskovi_odrzavanja
        ? parseFloat(formData.troskovi_odrzavanja)
        : null,
      zadnja_obnova: formData.zadnja_obnova || null,
    };
    const preparedUnits = unitsDraft
      .filter(
        (unit) =>
          (unit.oznaka && unit.oznaka.trim()) ||
          (unit.naziv && unit.naziv.trim()),
      )
      .map((unit) => ({
        oznaka: unit.oznaka.trim(),
        naziv: unit.naziv?.trim() || null,
        kat: unit.kat?.trim() || null,
        povrsina_m2: unit.povrsina_m2
          ? parseNumericValue(unit.povrsina_m2)
          : null,
        status: unit.status || "dostupno",
        osnovna_zakupnina: unit.osnovna_zakupnina
          ? parseNumericValue(unit.osnovna_zakupnina)
          : null,
        napomena: unit.napomena?.trim() || null,
      }));

    await onSubmit({ nekretnina: data, units: preparedUnits });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="nekretnina-form"
    >
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
                onChange={(e) =>
                  setFormData({ ...formData, naziv: e.target.value })
                }
                data-testid="nekretnina-naziv-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="vrsta">Vrsta nekretnine *</Label>
              <Select
                value={formData.vrsta}
                onValueChange={(value) =>
                  setFormData({ ...formData, vrsta: value })
                }
              >
                <SelectTrigger data-testid="nekretnina-vrsta-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poslovna_zgrada">
                    Poslovna zgrada
                  </SelectItem>
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
              onChange={(e) =>
                setFormData({ ...formData, adresa: e.target.value })
              }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    katastarska_opcina: e.target.value,
                  })
                }
                data-testid="nekretnina-ko-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="broj_kat_cestice">Broj kat. čestice *</Label>
              <Input
                id="broj_kat_cestice"
                value={formData.broj_kat_cestice}
                onChange={(e) =>
                  setFormData({ ...formData, broj_kat_cestice: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, povrsina: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, godina_izgradnje: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, vlasnik: e.target.value })
                }
                data-testid="nekretnina-vlasnik-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="udio_vlasnistva">Udio vlasništva *</Label>
              <Input
                id="udio_vlasnistva"
                value={formData.udio_vlasnistva}
                onChange={(e) =>
                  setFormData({ ...formData, udio_vlasnistva: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, nabavna_cijena: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    trzisna_vrijednost: e.target.value,
                  })
                }
                data-testid="nekretnina-trzisna-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prosllogodisnji_prihodi">
                Prošlogodišnji prihodi (€)
              </Label>
              <Input
                id="prosllogodisnji_prihodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_prihodi}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prosllogodisnji_prihodi: e.target.value,
                  })
                }
                data-testid="nekretnina-prihodi-input"
              />
            </div>
            <div>
              <Label htmlFor="prosllogodisnji_rashodi">
                Prošlogodišnji rashodi (€)
              </Label>
              <Input
                id="prosllogodisnji_rashodi"
                type="number"
                step="0.01"
                value={formData.prosllogodisnji_rashodi}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prosllogodisnji_rashodi: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, amortizacija: e.target.value })
                }
                data-testid="nekretnina-amortizacija-input"
              />
            </div>
            <div>
              <Label htmlFor="proslogodisnji_neto_prihod">
                Prošlogodišnji neto prihod (€)
              </Label>
              <Input
                id="proslogodisnji_neto_prihod"
                type="number"
                step="0.01"
                value={formData.proslogodisnji_neto_prihod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proslogodisnji_neto_prihod: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, zadnja_obnova: e.target.value })
                }
                data-testid="nekretnina-obnova-input"
              />
            </div>
            <div>
              <Label htmlFor="troskovi_odrzavanja">
                Troškovi održavanja (€)
              </Label>
              <Input
                id="troskovi_odrzavanja"
                type="number"
                step="0.01"
                value={formData.troskovi_odrzavanja}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    troskovi_odrzavanja: e.target.value,
                  })
                }
                data-testid="nekretnina-troskovi-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="potrebna_ulaganja">Potrebna ulaganja</Label>
            <Textarea
              id="potrebna_ulaganja"
              value={formData.potrebna_ulaganja}
              onChange={(e) =>
                setFormData({ ...formData, potrebna_ulaganja: e.target.value })
              }
              data-testid="nekretnina-ulaganja-input"
            />
          </div>

          <div>
            <Label htmlFor="osiguranje">Osiguranje</Label>
            <Input
              id="osiguranje"
              value={formData.osiguranje}
              onChange={(e) =>
                setFormData({ ...formData, osiguranje: e.target.value })
              }
              data-testid="nekretnina-osiguranje-input"
            />
          </div>

          <div>
            <Label htmlFor="napomene">Napomene i brojila</Label>
            <Textarea
              id="napomene"
              value={formData.napomene}
              onChange={(e) =>
                setFormData({ ...formData, napomene: e.target.value })
              }
              data-testid="nekretnina-napomene-input"
              rows={4}
              placeholder="Primjer: Struja – brojilo 12345; Voda – brojilo A44; Glavni ventil u ormaru L3; PIN za alarm 4321"
            />
            <p className="text-xs text-muted-foreground/80">
              Sačuvajte operativne napomene poput lokacija brojila, kodova,
              specifičnih procedura ili kontakata za održavanje.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="rizici" className="space-y-4">
          <div>
            <Label htmlFor="sudski_sporovi">Sudski sporovi</Label>
            <Textarea
              id="sudski_sporovi"
              value={formData.sudski_sporovi}
              onChange={(e) =>
                setFormData({ ...formData, sudski_sporovi: e.target.value })
              }
              data-testid="nekretnina-sporovi-input"
            />
          </div>

          <div>
            <Label htmlFor="hipoteke">Hipoteke</Label>
            <Textarea
              id="hipoteke"
              value={formData.hipoteke}
              onChange={(e) =>
                setFormData({ ...formData, hipoteke: e.target.value })
              }
              data-testid="nekretnina-hipoteke-input"
            />
          </div>

          <div>
            <Label htmlFor="napomene">Napomene</Label>
            <Textarea
              id="napomene"
              value={formData.napomene}
              onChange={(e) =>
                setFormData({ ...formData, napomene: e.target.value })
              }
              data-testid="nekretnina-napomene-input"
            />
          </div>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Plan podprostora
              </h4>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "Dodajte nove podprostore koje želite kreirati odmah. Postojeće jedinice ostaju nepromijenjene dok ih ne uredite u kartici detalja."
                  : "Dodajte podprostore koje želite kreirati odmah. Ovaj korak je opcionalan – jedinice se mogu dodati i kasnije u detalju nekretnine."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddUnitDraft}
            >
              <Plus className="w-4 h-4 mr-2" /> Dodaj podprostor
            </Button>
          </div>

          {isEditing && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Postojeći podprostori
                </p>
                <Badge variant="outline">{existingUnitsList.length}</Badge>
              </div>
              {existingUnitsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Trenutno nema podprostora kreiranih za ovu nekretninu.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {existingUnitsList.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-lg border border-border/50 bg-white/80 p-3"
                    >
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>{getUnitDisplayName(unit)}</span>
                        <Badge
                          className={`rounded-full text-[11px] ${getUnitStatusBadgeClass(unit.status)}`}
                        >
                          {formatUnitStatus(unit.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {unit.oznaka && (
                          <span className="rounded-full bg-muted px-2 py-1">
                            {unit.oznaka}
                          </span>
                        )}
                        {unit.kat && (
                          <span className="rounded-full bg-muted px-2 py-1">
                            {unit.kat}
                          </span>
                        )}
                        {unit.povrsina_m2 != null && (
                          <span className="rounded-full bg-muted px-2 py-1">{`${unit.povrsina_m2} m²`}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Za uređivanje postojećih podprostora otvorite detalj nekretnine
                i koristite karticu "Podprostori".
              </p>
            </div>
          )}

          {unitsDraft.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              {isEditing
                ? "Dodajte podprostor pomoću gumba iznad. Novi podprostori bit će kreirani nakon spremanja promjena."
                : "Još niste dodali nijednu jedinicu. Nakon spremanja nekretnine podprostori se mogu uređivati u zasebnoj kartici."}
            </div>
          ) : (
            <div className="space-y-3">
              {unitsDraft.map((unit, index) => (
                <div
                  key={unit.localId}
                  className="space-y-3 rounded-xl border border-border/60 bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Novi podprostor {index + 1}
                    </p>
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
                        onChange={(e) =>
                          handleUpdateUnitDraft(
                            unit.localId,
                            "oznaka",
                            e.target.value,
                          )
                        }
                        placeholder="npr. A2"
                        required
                      />
                    </div>
                    <div>
                      <Label>Naziv</Label>
                      <Input
                        value={unit.naziv}
                        onChange={(e) =>
                          handleUpdateUnitDraft(
                            unit.localId,
                            "naziv",
                            e.target.value,
                          )
                        }
                        placeholder="npr. Ured A2"
                      />
                    </div>
                    <div>
                      <Label>Kat / zona</Label>
                      <Input
                        value={unit.kat}
                        onChange={(e) =>
                          handleUpdateUnitDraft(
                            unit.localId,
                            "kat",
                            e.target.value,
                          )
                        }
                        placeholder="npr. Kat 3"
                      />
                    </div>
                    <div>
                      <Label>Površina (m²)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={unit.povrsina_m2}
                        onChange={(e) =>
                          handleUpdateUnitDraft(
                            unit.localId,
                            "povrsina_m2",
                            e.target.value,
                          )
                        }
                        placeholder="npr. 120"
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={unit.status}
                        onValueChange={(value) =>
                          handleUpdateUnitDraft(unit.localId, "status", value)
                        }
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
                        onChange={(e) =>
                          handleUpdateUnitDraft(
                            unit.localId,
                            "osnovna_zakupnina",
                            e.target.value,
                          )
                        }
                        placeholder="npr. 1500"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Napomena</Label>
                    <Textarea
                      value={unit.napomena}
                      onChange={(e) =>
                        handleUpdateUnitDraft(
                          unit.localId,
                          "napomena",
                          e.target.value,
                        )
                      }
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
        <Button
          type="submit"
          data-testid="potvrdi-nekretninu-form"
          disabled={submitting}
        >
          {submitting ? "Spremam..." : nekretnina ? "Ažuriraj" : "Kreiraj"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="odustani-nekretninu-form"
          disabled={submitting}
        >
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Zakupnici Component
const Zakupnici = () => {
  const {
    zakupnici,
    loading: storeLoading,
    error: storeError,
    refresh: refreshEntities,
  } = useEntityStore();
  const [searchValue, setSearchValue] = useState("");
  const [tenantView, setTenantView] = useState("active");
  const [contactSegment, setContactSegment] = useState("zakupnici");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingZakupnik, setEditingZakupnik] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createTip, setCreateTip] = useState("zakupnik");

  const {
    logs: tenantAuditLogs,
    loading: tenantAuditLoading,
    error: tenantAuditError,
  } = useAuditTimeline("tenant", editingZakupnik?.id, {
    limit: 20,
    enabled: Boolean(editingZakupnik?.id),
  });

  useEffect(() => {
    setTenantView("active");
    setCreateTip(contactSegment === "partneri" ? "partner" : "zakupnik");
  }, [contactSegment]);

  const segmentTip = contactSegment === "partneri" ? "partner" : "zakupnik";

  const segmentZakupnici = useMemo(
    () =>
      zakupnici.filter((tenant) => (tenant.tip || "zakupnik") === segmentTip),
    [zakupnici, segmentTip],
  );

  const activeCount = useMemo(
    () =>
      segmentZakupnici.filter(
        (tenant) => (tenant.status || "aktivan") !== "arhiviran",
      ).length,
    [segmentZakupnici],
  );
  const archivedCount = useMemo(
    () =>
      segmentZakupnici.filter(
        (tenant) => (tenant.status || "aktivan") === "arhiviran",
      ).length,
    [segmentZakupnici],
  );

  const filteredZakupnici = useMemo(() => {
    const base = segmentZakupnici.filter((tenant) => {
      const status = tenant.status || "aktivan";
      return tenantView === "archived"
        ? status === "arhiviran"
        : status !== "arhiviran";
    });

    const trimmed = searchValue.trim();
    if (!trimmed) {
      return base;
    }

    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const pick = (value) => (value || "").toString().toLowerCase();

    return base.filter((tenant) => {
      const contactHaystack = Array.isArray(tenant.kontakt_osobe)
        ? tenant.kontakt_osobe.flatMap((kontakt) => [
            kontakt.ime,
            kontakt.uloga,
            kontakt.email,
            kontakt.telefon,
            kontakt.napomena,
            kontakt.preferirani_kanal,
          ])
        : [];

      const haystack = [
        tenant.naziv_firme,
        tenant.ime_prezime,
        tenant.oib,
        tenant.sjediste,
        tenant.kontakt_ime,
        tenant.kontakt_email,
        tenant.kontakt_telefon,
        tenant.iban,
        tenant.opis_usluge,
        tenant.radno_vrijeme,
        tenant.biljeske,
        ...(tenant.oznake || []),
        ...contactHaystack,
      ].map(pick);

      return tokens.every((token) =>
        haystack.some((field) => field.includes(token)),
      );
    });
  }, [segmentZakupnici, searchValue, tenantView]);

  const handleCreateZakupnik = async (formData) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        tip: formData.tip || createTip,
        status: formData.status || "aktivan",
      };
      await api.createZakupnik(payload);
      toast.success(
        payload.tip === "partner"
          ? "Partner je uspješno kreiran"
          : "Zakupnik je uspješno kreiran",
      );
      setShowCreateForm(false);
      try {
        await refreshEntities();
      } catch (refreshError) {
        console.error(
          "Greška pri osvježavanju zakupnika nakon kreiranja:",
          refreshError,
        );
        toast.warning(
          "Zakupnik je dodan, ali lista nije osvježena automatski.",
        );
      }
    } catch (error) {
      console.error("Greška pri kreiranju zakupnika:", error);
      toast.error("Greška pri kreiranju zakupnika");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZakupnik = async (formData) => {
    if (!editingZakupnik || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        tip: formData.tip || editingZakupnik.tip || "zakupnik",
        status: formData.status || "aktivan",
      };
      await api.updateZakupnik(editingZakupnik.id, payload);
      toast.success(
        payload.tip === "partner"
          ? "Partner je uspješno ažuriran"
          : "Zakupnik je uspješno ažuriran",
      );
      setEditingZakupnik(null);
      try {
        await refreshEntities();
      } catch (refreshError) {
        console.error(
          "Greška pri osvježavanju zakupnika nakon ažuriranja:",
          refreshError,
        );
        toast.warning("Zakupnik je ažuriran, ali prikaz nije osvježen.");
      }
    } catch (error) {
      console.error("Greška pri ažuriranju zakupnika:", error);
      toast.error("Greška pri ažuriranju zakupnika");
    } finally {
      setSubmitting(false);
    }
  };

  const buildZakupnikPayload = (tenant, overrides = {}) => {
    const trim = (value) => (value ?? "").toString().trim();
    const normaliseInt = (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const contacts = Array.isArray(tenant.kontakt_osobe)
      ? tenant.kontakt_osobe.map((kontakt, index) => ({
          id:
            kontakt.id ||
            kontakt.localId ||
            `kontakt-${tenant.id || "temp"}-${index}`,
          ime:
            trim(kontakt.ime) ||
            trim(kontakt.email) ||
            trim(kontakt.telefon) ||
            "Kontakt",
          uloga: trim(kontakt.uloga) || null,
          email: trim(kontakt.email) || null,
          telefon: trim(kontakt.telefon) || null,
          napomena: trim(kontakt.napomena) || null,
          preferirani_kanal: trim(kontakt.preferirani_kanal) || null,
          hitnost_odziva_sati: normaliseInt(kontakt.hitnost_odziva_sati),
        }))
      : [];

    if (!contacts.length) {
      contacts.push({
        id: `kontakt-${tenant.id || Date.now()}`,
        ime:
          trim(tenant.kontakt_ime) ||
          trim(tenant.naziv_firme) ||
          trim(tenant.ime_prezime) ||
          "Kontakt",
        uloga: null,
        email: trim(tenant.kontakt_email) || null,
        telefon: trim(tenant.kontakt_telefon) || null,
        napomena: null,
        preferirani_kanal: null,
        hitnost_odziva_sati: normaliseInt(tenant.hitnost_odziva_sati),
      });
    }

    return {
      naziv_firme: trim(tenant.naziv_firme) || null,
      ime_prezime: trim(tenant.ime_prezime) || null,
      oib: trim(tenant.oib),
      sjediste: trim(tenant.sjediste),
      kontakt_ime: trim(tenant.kontakt_ime),
      kontakt_email: trim(tenant.kontakt_email),
      kontakt_telefon: trim(tenant.kontakt_telefon),
      iban: trim(tenant.iban) || null,
      status: overrides.status || tenant.status || "aktivan",
      tip: overrides.tip || tenant.tip || "zakupnik",
      oznake: Array.isArray(tenant.oznake) ? tenant.oznake.filter(Boolean) : [],
      opis_usluge: trim(tenant.opis_usluge) || null,
      radno_vrijeme: trim(tenant.radno_vrijeme) || null,
      biljeske: trim(tenant.biljeske) || null,
      hitnost_odziva_sati: normaliseInt(tenant.hitnost_odziva_sati),
      kontakt_osobe: contacts,
    };
  };

  const handleToggleArchive = async (tenant, nextStatus) => {
    try {
      const payload = buildZakupnikPayload(tenant, { status: nextStatus });
      await api.updateZakupnik(tenant.id, payload);
      const label =
        (payload.tip || "zakupnik") === "partner" ? "Partner" : "Zakupnik";
      toast.success(
        nextStatus === "arhiviran"
          ? `${label} je arhiviran`
          : `${label} je ponovno aktivan`,
      );
      await refreshEntities();
    } catch (error) {
      console.error("Greška pri promjeni statusa zakupnika:", error);
      toast.error("Promjena statusa zakupnika nije uspjela");
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
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            Zakupnici i partneri
          </h1>
          <p className="text-sm text-muted-foreground">
            Centralna baza zakupnika i servisnih suradnika s glavnim kontaktima,
            SLA obavezama i operativnim napomenama.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:max-w-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
              <Button
                size="sm"
                variant={contactSegment === "zakupnici" ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setContactSegment("zakupnici")}
              >
                Zakupnici
              </Button>
              <Button
                size="sm"
                variant={contactSegment === "partneri" ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setContactSegment("partneri")}
              >
                Partneri
              </Button>
            </div>
            <div className="relative flex-1 md:flex-initial md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={
                  contactSegment === "partneri"
                    ? "Pretraži partnere..."
                    : "Pretraži zakupnike..."
                }
                className="pl-10"
                aria-label={
                  contactSegment === "partneri"
                    ? "Pretraži partnere"
                    : "Pretraži zakupnike"
                }
                data-testid="zakupnici-search-input"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={tenantView === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setTenantView("active")}
              >
                Aktivni ({activeCount})
              </Button>
              <Button
                variant={tenantView === "archived" ? "default" : "outline"}
                size="sm"
                onClick={() => setTenantView("archived")}
                disabled={archivedCount === 0}
              >
                Arhivirani ({archivedCount})
              </Button>
            </div>
            <Button
              onClick={() => {
                setShowCreateForm(true);
                setCreateTip(segmentTip);
              }}
              data-testid="dodaj-zakupnika-btn"
              className="h-11 rounded-full bg-primary text-primary-foreground shadow-shell hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span className="ml-2">
                {segmentTip === "partner"
                  ? "Dodaj partnera"
                  : "Dodaj zakupnika"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {filteredZakupnici.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              {tenantView === "archived"
                ? `Nema arhiviranih ${segmentTip === "partner" ? "partnera" : "zakupnika"}`
                : "Nema rezultata"}
            </p>
            <p className="text-sm text-muted-foreground">
              {tenantView === "archived"
                ? `${segmentTip === "partner" ? "Partneri" : "Zakupnici"} koje arhivirate prikazat će se ovdje.`
                : `Pokušajte s drugim upitom ili dodajte novog ${segmentTip === "partner" ? "partnera" : "zakupnika"}.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredZakupnici.map((zakupnik) => {
            const isPartner = (zakupnik.tip || "zakupnik") === "partner";
            const displayName =
              zakupnik.naziv_firme ||
              zakupnik.ime_prezime ||
              "Nepoznati kontakt";
            const entityType = isPartner
              ? "Partner"
              : zakupnik.naziv_firme
                ? "Tvrtka"
                : "Osoba";
            const isArchived = (zakupnik.status || "aktivan") === "arhiviran";
            const kontaktOsobe = Array.isArray(zakupnik.kontakt_osobe)
              ? zakupnik.kontakt_osobe
              : [];
            const primaryContact = kontaktOsobe[0] || null;
            const additionalContacts = kontaktOsobe.slice(1);
            const primaryName =
              primaryContact?.ime || zakupnik.kontakt_ime || null;
            const primaryRole = primaryContact?.uloga || null;
            const primaryPhone =
              primaryContact?.telefon || zakupnik.kontakt_telefon || null;
            const primaryEmail =
              primaryContact?.email || zakupnik.kontakt_email || null;
            const preferredChannel = primaryContact?.preferirani_kanal || null;
            const slaRaw =
              primaryContact?.hitnost_odziva_sati ??
              zakupnik.hitnost_odziva_sati;
            const slaValue =
              slaRaw !== null && slaRaw !== undefined && slaRaw !== ""
                ? `${slaRaw} h`
                : null;
            const tags = Array.isArray(zakupnik.oznake)
              ? zakupnik.oznake.filter(Boolean)
              : [];
            const fiskalAddressParts = [
              zakupnik.adresa_ulica,
              zakupnik.adresa_kucni_broj,
              zakupnik.adresa_postanski_broj,
              zakupnik.adresa_grad,
            ].filter(Boolean);
            const fiskalAddress = fiskalAddressParts.join(" ");
            const addressDisplay =
              fiskalAddress || zakupnik.sjediste || "Adresa nije navedena";

            const summaryFields = [
              { label: "OIB", value: zakupnik.oib || "—" },
              {
                label: "Telefon",
                value: primaryPhone || "Telefon nije zabilježen",
              },
              primaryEmail && {
                label: "Email",
                value: (
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {primaryEmail}
                  </a>
                ),
              },
              { label: "Adresa", value: addressDisplay },
              primaryName && {
                label: "Primarni kontakt",
                value: primaryRole
                  ? `${primaryName} (${primaryRole})`
                  : primaryName,
              },
              preferredChannel && {
                label: "Preferirani kanal",
                value: preferredChannel,
              },
              slaValue && {
                label: "SLA odziv",
                value: slaValue,
              },
              zakupnik.odgovorna_osoba && {
                label: "Odgovorna osoba",
                value: zakupnik.odgovorna_osoba,
              },
              zakupnik.iban && {
                label: "IBAN",
                value: zakupnik.iban,
              },
              zakupnik.pdv_obveznik !== undefined &&
                zakupnik.pdv_obveznik !== null && {
                  label: "PDV obveznik",
                  value: formatBooleanish(zakupnik.pdv_obveznik),
                },
              zakupnik.pdv_id && {
                label: "PDV ID",
                value: zakupnik.pdv_id,
              },
              zakupnik.maticni_broj && {
                label: "Matični broj",
                value: zakupnik.maticni_broj,
              },
              zakupnik.registracijski_broj && {
                label: "Registracijski broj",
                value: zakupnik.registracijski_broj,
              },
            ].filter(Boolean);

            const eracunFields = [
              zakupnik.eracun_identifikator && {
                label: "Identifikator",
                value: zakupnik.eracun_identifikator,
              },
              zakupnik.eracun_dostava_kanal && {
                label: "Kanal dostave",
                value: zakupnik.eracun_dostava_kanal,
              },
              zakupnik.eracun_posrednik && {
                label: "Posrednik",
                value: zakupnik.eracun_posrednik,
              },
              zakupnik.eracun_email && {
                label: "Kontakt email",
                value: (
                  <a
                    href={`mailto:${zakupnik.eracun_email}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {zakupnik.eracun_email}
                  </a>
                ),
              },
            ].filter(Boolean);

            const operationsFields = [
              zakupnik.radno_vrijeme && {
                label: "Radno vrijeme",
                value: zakupnik.radno_vrijeme,
              },
            ].filter(Boolean);

            return (
              <Card
                key={zakupnik.id}
                data-testid={`zakupnik-card-${zakupnik.id}`}
                className="card-hover shadow-shell"
              >
                <CardHeader className="border-b border-border/40 bg-primary/5 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {displayName}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide">
                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/30 bg-white/70 text-primary"
                        >
                          {entityType}
                        </Badge>
                        {isPartner && slaValue && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-300 bg-emerald-50 text-emerald-700"
                          >
                            SLA {slaValue}
                          </Badge>
                        )}
                        {isArchived && (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-muted text-muted-foreground"
                          >
                            Arhiviran
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-6 text-sm text-muted-foreground">
                  {summaryFields.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {summaryFields.map((field) => (
                        <InfoField
                          key={`${zakupnik.id}-${field.label}`}
                          label={field.label}
                          value={field.value}
                        />
                      ))}
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={`${zakupnik.id}-${tag}`}
                          variant="outline"
                          className="rounded-full bg-white text-[11px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {(eracunFields.length > 0 ||
                    operationsFields.length > 0 ||
                    zakupnik.fiskalizacija_napomena ||
                    additionalContacts.length > 0) && (
                    <Accordion
                      type="multiple"
                      className="rounded-lg border border-border/40 bg-muted/10"
                    >
                      {(eracunFields.length > 0 ||
                        zakupnik.fiskalizacija_napomena) && (
                        <AccordionItem value="eracun">
                          <AccordionTrigger className="px-3 text-sm font-semibold text-foreground">
                            eRačun & fiskalizacija
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 px-3">
                            {eracunFields.length > 0 && (
                              <div className="grid gap-3 md:grid-cols-2">
                                {eracunFields.map((field) => (
                                  <InfoField
                                    key={`${zakupnik.id}-eracun-${field.label}`}
                                    label={field.label}
                                    value={field.value}
                                  />
                                ))}
                              </div>
                            )}
                            {zakupnik.fiskalizacija_napomena && (
                              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                                {zakupnik.fiskalizacija_napomena}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {(operationsFields.length > 0 ||
                        zakupnik.biljeske ||
                        (isPartner && zakupnik.opis_usluge)) && (
                        <AccordionItem value="operations">
                          <AccordionTrigger className="px-3 text-sm font-semibold text-foreground">
                            Operativne bilješke
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 px-3">
                            {operationsFields.length > 0 && (
                              <div className="grid gap-3 md:grid-cols-2">
                                {operationsFields.map((field) => (
                                  <InfoField
                                    key={`${zakupnik.id}-ops-${field.label}`}
                                    label={field.label}
                                    value={field.value}
                                  />
                                ))}
                              </div>
                            )}
                            {isPartner && zakupnik.opis_usluge && (
                              <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                                {zakupnik.opis_usluge}
                              </div>
                            )}
                            {zakupnik.biljeske && (
                              <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                                {zakupnik.biljeske}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {additionalContacts.length > 0 && (
                        <AccordionItem value="contacts">
                          <AccordionTrigger className="px-3 text-sm font-semibold text-foreground">
                            Dodatni kontakti
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 px-3">
                            {additionalContacts.map((kontakt) => (
                              <div
                                key={
                                  kontakt.id || `${zakupnik.id}-${kontakt.ime}`
                                }
                                className="rounded-lg border border-border/40 bg-white/80 p-2 text-xs text-muted-foreground"
                              >
                                <p className="font-semibold text-foreground">
                                  {kontakt.ime}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {kontakt.uloga && (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full"
                                    >
                                      {kontakt.uloga}
                                    </Badge>
                                  )}
                                  {kontakt.email && (
                                    <a
                                      href={`mailto:${kontakt.email}`}
                                      className="text-primary underline-offset-2 hover:underline"
                                    >
                                      {kontakt.email}
                                    </a>
                                  )}
                                  {kontakt.telefon && (
                                    <span>{kontakt.telefon}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-muted-foreground/70">
                      Tip kontakta:{" "}
                      <span className="font-medium text-foreground">
                        {entityType}
                      </span>
                      {slaValue ? ` • SLA ${slaValue}` : ""}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setContactSegment(
                            isPartner ? "partneri" : "zakupnici",
                          );
                          setEditingZakupnik(zakupnik);
                        }}
                        data-testid={`uredi-zakupnika-${zakupnik.id}`}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="ml-2">Uredi</span>
                      </Button>
                      <Button
                        variant={isArchived ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() =>
                          handleToggleArchive(
                            zakupnik,
                            isArchived ? "aktivan" : "arhiviran",
                          )
                        }
                      >
                        {isArchived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                        <span className="ml-2">
                          {isArchived ? "Vrati" : "Arhiviraj"}
                        </span>
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
        <DialogContent
          className="max-w-2xl"
          aria-describedby="dodaj-zakupnika-form-description"
        >
          <DialogHeader>
            <DialogTitle>
              {createTip === "partner" ? "Dodaj partnera" : "Dodaj zakupnika"}
            </DialogTitle>
          </DialogHeader>
          <div id="dodaj-zakupnika-form-description" className="sr-only">
            Forma za kreiranje novog zakupnika
          </div>
          <ZakupnikForm
            onSubmit={handleCreateZakupnik}
            onCancel={() => setShowCreateForm(false)}
            submitting={submitting}
            defaultTip={createTip}
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
        <DialogContent
          className="max-w-2xl"
          aria-describedby="uredi-zakupnik-form-description"
        >
          <DialogHeader>
            <DialogTitle>
              {(editingZakupnik?.tip || "zakupnik") === "partner"
                ? "Uredi partnera"
                : "Uredi zakupnika"}
            </DialogTitle>
          </DialogHeader>
          <div id="uredi-zakupnik-form-description" className="sr-only">
            Forma za ažuriranje postojećeg zakupnika
          </div>
          <div className="space-y-6">
            <ZakupnikForm
              zakupnik={editingZakupnik}
              onSubmit={handleUpdateZakupnik}
              onCancel={() => setEditingZakupnik(null)}
              submitting={submitting}
              defaultTip={editingZakupnik?.tip || "zakupnik"}
            />
            <AuditTimelinePanel
              className="border-t border-border/60 pt-4"
              title="Audit zapis zakupnika"
              logs={tenantAuditLogs}
              loading={tenantAuditLoading}
              error={tenantAuditError}
              emptyMessage="Još nema audit zapisa za ovog zakupnika."
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Zakupnik Form Component
const ZakupnikForm = ({
  zakupnik,
  onSubmit,
  onCancel,
  submitting = false,
  defaultTip = "zakupnik",
}) => {
  const makeLocalId = useCallback(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `kontakt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }, []);

  const initialState = useMemo(() => {
    const tip = zakupnik?.tip || defaultTip || "zakupnik";
    const primaryContact = zakupnik?.kontakt_osobe?.[0] || null;

    const form = {
      tip,
      naziv_firme: zakupnik?.naziv_firme || "",
      ime_prezime: zakupnik?.ime_prezime || "",
      oib: zakupnik?.oib || "",
      sjediste: zakupnik?.sjediste || "",
      adresa_ulica: zakupnik?.adresa_ulica || "",
      adresa_kucni_broj: zakupnik?.adresa_kucni_broj || "",
      adresa_postanski_broj: zakupnik?.adresa_postanski_broj || "",
      adresa_grad: zakupnik?.adresa_grad || "",
      adresa_drzava: zakupnik?.adresa_drzava || "",
      kontakt_ime: primaryContact?.ime || zakupnik?.kontakt_ime || "",
      kontakt_email: primaryContact?.email || zakupnik?.kontakt_email || "",
      kontakt_telefon:
        primaryContact?.telefon || zakupnik?.kontakt_telefon || "",
      iban: zakupnik?.iban || "",
      pdv_obveznik: Boolean(zakupnik?.pdv_obveznik),
      pdv_id: zakupnik?.pdv_id || "",
      maticni_broj: zakupnik?.maticni_broj || "",
      registracijski_broj: zakupnik?.registracijski_broj || "",
      eracun_dostava_kanal: zakupnik?.eracun_dostava_kanal || "",
      eracun_identifikator: zakupnik?.eracun_identifikator || "",
      eracun_email: zakupnik?.eracun_email || "",
      eracun_posrednik: zakupnik?.eracun_posrednik || "",
      fiskalizacija_napomena: zakupnik?.fiskalizacija_napomena || "",
      odgovorna_osoba: zakupnik?.odgovorna_osoba || "",
      status: zakupnik?.status || "aktivan",
      primary_uloga: primaryContact?.uloga || "",
      primary_preferirani_kanal: primaryContact?.preferirani_kanal || "",
      primary_napomena: primaryContact?.napomena || "",
      hitnost_odziva_sati:
        primaryContact?.hitnost_odziva_sati != null
          ? String(primaryContact.hitnost_odziva_sati)
          : zakupnik?.hitnost_odziva_sati != null
            ? String(zakupnik.hitnost_odziva_sati)
            : "",
      oznake_input: Array.isArray(zakupnik?.oznake)
        ? zakupnik.oznake.join(", ")
        : "",
      opis_usluge: zakupnik?.opis_usluge || "",
      radno_vrijeme: zakupnik?.radno_vrijeme || "",
      biljeske: zakupnik?.biljeske || "",
    };

    const contacts = (zakupnik?.kontakt_osobe || [])
      .slice(1)
      .map((kontakt) => ({
        localId: kontakt.id || makeLocalId(),
        id: kontakt.id || null,
        ime: kontakt.ime || "",
        uloga: kontakt.uloga || "",
        email: kontakt.email || "",
        telefon: kontakt.telefon || "",
        napomena: kontakt.napomena || "",
        preferirani_kanal: kontakt.preferirani_kanal || "",
        hitnost_odziva_sati:
          kontakt.hitnost_odziva_sati != null
            ? String(kontakt.hitnost_odziva_sati)
            : "",
      }));

    return { form, contacts };
  }, [zakupnik, defaultTip, makeLocalId]);

  const [formData, setFormData] = useState(initialState.form);
  const [extraContacts, setExtraContacts] = useState(initialState.contacts);

  useEffect(() => {
    setFormData(initialState.form);
    setExtraContacts(initialState.contacts);
  }, [initialState]);

  const resolvedTags = useMemo(
    () =>
      formData.oznake_input
        .split(/[\n,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    [formData.oznake_input],
  );

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const createEmptyContact = useCallback(
    () => ({
      localId: makeLocalId(),
      id: null,
      ime: "",
      uloga: "",
      email: "",
      telefon: "",
      napomena: "",
      preferirani_kanal: "",
      hitnost_odziva_sati: "",
    }),
    [makeLocalId],
  );

  const handleAddContact = () => {
    setExtraContacts((prev) => [...prev, createEmptyContact()]);
  };

  const handleContactChange = (localId, field, value) => {
    setExtraContacts((prev) =>
      prev.map((kontakt) =>
        kontakt.localId === localId ? { ...kontakt, [field]: value } : kontakt,
      ),
    );
  };

  const handleRemoveContact = (localId) => {
    setExtraContacts((prev) =>
      prev.filter((kontakt) => kontakt.localId !== localId),
    );
  };

  const trimString = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value.trim();
    }
    return String(value).trim();
  };
  const parseOptionalInt = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const primaryContactId = zakupnik?.kontakt_osobe?.[0]?.id || makeLocalId();

    const primaryContactPayload = {
      id: primaryContactId,
      ime: trimString(formData.kontakt_ime) || "Kontakt",
      uloga: trimString(formData.primary_uloga) || null,
      email: trimString(formData.kontakt_email) || null,
      telefon: trimString(formData.kontakt_telefon) || null,
      napomena: trimString(formData.primary_napomena) || null,
      preferirani_kanal: trimString(formData.primary_preferirani_kanal) || null,
      hitnost_odziva_sati: parseOptionalInt(formData.hitnost_odziva_sati),
    };

    const normalisedExtraContacts = extraContacts
      .map((kontakt) => {
        const name = trimString(kontakt.ime);
        const fallbackName =
          name || trimString(kontakt.email) || trimString(kontakt.telefon);
        if (!fallbackName) {
          return null;
        }
        return {
          id: kontakt.id || kontakt.localId || makeLocalId(),
          ime: fallbackName,
          uloga: trimString(kontakt.uloga) || null,
          email: trimString(kontakt.email) || null,
          telefon: trimString(kontakt.telefon) || null,
          napomena: trimString(kontakt.napomena) || null,
          preferirani_kanal: trimString(kontakt.preferirani_kanal) || null,
          hitnost_odziva_sati: parseOptionalInt(kontakt.hitnost_odziva_sati),
        };
      })
      .filter(Boolean);

    const kontakt_osobe = [primaryContactPayload, ...normalisedExtraContacts];

    const composedAddress = [
      trimString(formData.adresa_ulica),
      trimString(formData.adresa_kucni_broj),
      trimString(formData.adresa_postanski_broj),
      trimString(formData.adresa_grad),
      trimString(formData.adresa_drzava),
    ]
      .filter(Boolean)
      .join(" ");

    const payload = {
      tip: formData.tip,
      naziv_firme: trimString(formData.naziv_firme) || null,
      ime_prezime: trimString(formData.ime_prezime) || null,
      oib: trimString(formData.oib),
      sjediste: composedAddress || trimString(formData.sjediste),
      adresa_ulica: trimString(formData.adresa_ulica) || null,
      adresa_kucni_broj: trimString(formData.adresa_kucni_broj) || null,
      adresa_postanski_broj: trimString(formData.adresa_postanski_broj) || null,
      adresa_grad: trimString(formData.adresa_grad) || null,
      adresa_drzava: trimString(formData.adresa_drzava) || null,
      kontakt_ime: trimString(formData.kontakt_ime),
      kontakt_email: trimString(formData.kontakt_email),
      kontakt_telefon: trimString(formData.kontakt_telefon),
      iban: trimString(formData.iban) || null,
      pdv_obveznik: Boolean(formData.pdv_obveznik),
      pdv_id: trimString(formData.pdv_id) || null,
      maticni_broj: trimString(formData.maticni_broj) || null,
      registracijski_broj: trimString(formData.registracijski_broj) || null,
      eracun_dostava_kanal: trimString(formData.eracun_dostava_kanal) || null,
      eracun_identifikator: trimString(formData.eracun_identifikator) || null,
      eracun_email: trimString(formData.eracun_email) || null,
      eracun_posrednik: trimString(formData.eracun_posrednik) || null,
      fiskalizacija_napomena:
        trimString(formData.fiskalizacija_napomena) || null,
      odgovorna_osoba: trimString(formData.odgovorna_osoba) || null,
      status: formData.status || "aktivan",
      oznake: resolvedTags,
      opis_usluge: trimString(formData.opis_usluge) || null,
      radno_vrijeme: trimString(formData.radno_vrijeme) || null,
      biljeske: trimString(formData.biljeske) || null,
      hitnost_odziva_sati: parseOptionalInt(formData.hitnost_odziva_sati),
      kontakt_osobe,
    };

    await onSubmit(payload);
  };

  const isPartner = formData.tip === "partner";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-testid="zakupnik-form"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="tip">Tip kontakta *</Label>
          <Select
            value={formData.tip}
            onValueChange={(value) => updateForm("tip", value)}
          >
            <SelectTrigger
              id="tip"
              className="mt-1"
              data-testid="zakupnik-tip-select"
            >
              <SelectValue placeholder="Odaberite tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zakupnik">Zakupnik</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => updateForm("status", value)}
          >
            <SelectTrigger data-testid="zakupnik-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aktivan">Aktivan</SelectItem>
              <SelectItem value="arhiviran">Arhiviran</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="naziv_firme">
            {isPartner ? "Naziv partnera" : "Naziv firme"}
          </Label>
          <Input
            id="naziv_firme"
            value={formData.naziv_firme}
            onChange={(event) => updateForm("naziv_firme", event.target.value)}
            data-testid="zakupnik-naziv-input"
          />
        </div>
        <div>
          <Label htmlFor="ime_prezime">Ime i prezime</Label>
          <Input
            id="ime_prezime"
            value={formData.ime_prezime}
            onChange={(event) => updateForm("ime_prezime", event.target.value)}
            data-testid="zakupnik-ime-input"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="oib">OIB / VAT ID *</Label>
          <Input
            id="oib"
            value={formData.oib}
            onChange={(event) => updateForm("oib", event.target.value)}
            data-testid="zakupnik-oib-input"
            required
          />
        </div>
        <div>
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(event) => updateForm("iban", event.target.value)}
            data-testid="zakupnik-iban-input"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Primarni kontakt
            </h3>
            <p className="text-xs text-muted-foreground">
              Koristi se za brzu komunikaciju, generiranje dokumenata i
              podsjetnike.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="kontakt_ime">Kontakt osoba *</Label>
            <Input
              id="kontakt_ime"
              value={formData.kontakt_ime}
              onChange={(event) =>
                updateForm("kontakt_ime", event.target.value)
              }
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
              onChange={(event) =>
                updateForm("kontakt_email", event.target.value)
              }
              data-testid="zakupnik-email-input"
              required
            />
          </div>
          <div>
            <Label htmlFor="kontakt_telefon">Telefon *</Label>
            <Input
              id="kontakt_telefon"
              value={formData.kontakt_telefon}
              onChange={(event) =>
                updateForm("kontakt_telefon", event.target.value)
              }
              data-testid="zakupnik-telefon-input"
              required
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="primary_uloga">Uloga</Label>
            <Input
              id="primary_uloga"
              value={formData.primary_uloga}
              onChange={(event) =>
                updateForm("primary_uloga", event.target.value)
              }
            />
          </div>
          <div>
            <Label htmlFor="primary_preferirani_kanal">Preferirani kanal</Label>
            <Input
              id="primary_preferirani_kanal"
              value={formData.primary_preferirani_kanal}
              onChange={(event) =>
                updateForm("primary_preferirani_kanal", event.target.value)
              }
              placeholder="npr. Email, Telefon"
            />
          </div>
          <div>
            <Label htmlFor="hitnost_odziva_sati">Odziv (h)</Label>
            <Input
              id="hitnost_odziva_sati"
              type="number"
              min="0"
              value={formData.hitnost_odziva_sati}
              onChange={(event) =>
                updateForm("hitnost_odziva_sati", event.target.value)
              }
              placeholder="npr. 4"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="primary_napomena">Napomena</Label>
          <Textarea
            id="primary_napomena"
            value={formData.primary_napomena}
            onChange={(event) =>
              updateForm("primary_napomena", event.target.value)
            }
            rows={2}
            placeholder="Posebne upute, raspoloživost ili SLA dogovori"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="oznake">Oznake</Label>
        <Input
          id="oznake"
          value={formData.oznake_input}
          onChange={(event) => updateForm("oznake_input", event.target.value)}
          placeholder="npr. Električar, 24/7, SLA A"
        />
        <p className="text-xs text-muted-foreground">
          Razdvojite oznake zarezom ili novim redom.
        </p>
        {resolvedTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {resolvedTags.map((tag) => (
              <Badge
                key={`tag-preview-${tag}`}
                variant="outline"
                className="rounded-full bg-white text-[11px]"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isPartner && (
        <div>
          <Label htmlFor="opis_usluge">Opis suradnje</Label>
          <Textarea
            id="opis_usluge"
            value={formData.opis_usluge}
            onChange={(event) => updateForm("opis_usluge", event.target.value)}
            rows={3}
            placeholder="Koje poslove partner pokriva, područje odgovornosti, SLA..."
          />
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={["address"]}
        className="overflow-hidden rounded-xl border border-border/60 bg-white/70"
      >
        <AccordionItem
          value="address"
          className="border-border/60 last:border-b-0"
        >
          <AccordionTrigger className="px-4 text-sm font-semibold text-foreground">
            Adresni podaci
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-4">
            <p className="text-xs text-muted-foreground">
              Adresa se koristi za fiskalizaciju i generiranje ugovora.
            </p>
            {formData.sjediste &&
              !formData.adresa_ulica &&
              !formData.adresa_kucni_broj &&
              !formData.adresa_postanski_broj &&
              !formData.adresa_grad && (
                <p className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  Trenutno sjedište: {formData.sjediste}
                </p>
              )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="adresa_ulica">Ulica</Label>
                <Input
                  id="adresa_ulica"
                  value={formData.adresa_ulica}
                  onChange={(event) =>
                    updateForm("adresa_ulica", event.target.value)
                  }
                  placeholder="npr. Ulica Ivana Gorana Kovačića"
                />
              </div>
              <div>
                <Label htmlFor="adresa_kucni_broj">Kućni broj</Label>
                <Input
                  id="adresa_kucni_broj"
                  value={formData.adresa_kucni_broj}
                  onChange={(event) =>
                    updateForm("adresa_kucni_broj", event.target.value)
                  }
                  placeholder="npr. 12A"
                />
              </div>
              <div>
                <Label htmlFor="adresa_postanski_broj">Poštanski broj</Label>
                <Input
                  id="adresa_postanski_broj"
                  value={formData.adresa_postanski_broj}
                  onChange={(event) =>
                    updateForm("adresa_postanski_broj", event.target.value)
                  }
                  placeholder="npr. 10000"
                />
              </div>
              <div>
                <Label htmlFor="adresa_grad">Grad / mjesto</Label>
                <Input
                  id="adresa_grad"
                  value={formData.adresa_grad}
                  onChange={(event) =>
                    updateForm("adresa_grad", event.target.value)
                  }
                  placeholder="npr. Zagreb"
                />
              </div>
              <div>
                <Label htmlFor="adresa_drzava">Država</Label>
                <Input
                  id="adresa_drzava"
                  value={formData.adresa_drzava}
                  onChange={(event) =>
                    updateForm("adresa_drzava", event.target.value)
                  }
                  placeholder="npr. Hrvatska"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="compliance"
          className="border-border/60 last:border-b-0"
        >
          <AccordionTrigger className="px-4 text-sm font-semibold text-foreground">
            PDV i registri
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pdv_obveznik">PDV obveznik</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                  <Switch
                    id="pdv_obveznik"
                    checked={Boolean(formData.pdv_obveznik)}
                    onCheckedChange={(value) =>
                      updateForm("pdv_obveznik", Boolean(value))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.pdv_obveznik ? "Da" : "Ne"}
                  </span>
                </div>
              </div>
              <div>
                <Label htmlFor="pdv_id">PDV ID</Label>
                <Input
                  id="pdv_id"
                  value={formData.pdv_id}
                  onChange={(event) => updateForm("pdv_id", event.target.value)}
                  placeholder="npr. HR12345678901"
                />
              </div>
              <div>
                <Label htmlFor="maticni_broj">Matični broj</Label>
                <Input
                  id="maticni_broj"
                  value={formData.maticni_broj}
                  onChange={(event) =>
                    updateForm("maticni_broj", event.target.value)
                  }
                  placeholder="npr. 081234567"
                />
              </div>
              <div>
                <Label htmlFor="registracijski_broj">Registracijski broj</Label>
                <Input
                  id="registracijski_broj"
                  value={formData.registracijski_broj}
                  onChange={(event) =>
                    updateForm("registracijski_broj", event.target.value)
                  }
                  placeholder="npr. MBS 081234567"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="odgovorna_osoba">Odgovorna osoba</Label>
                <Input
                  id="odgovorna_osoba"
                  value={formData.odgovorna_osoba}
                  onChange={(event) =>
                    updateForm("odgovorna_osoba", event.target.value)
                  }
                  placeholder="npr. Ivana Horvat"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="eracun"
          className="border-border/60 last:border-b-0"
        >
          <AccordionTrigger className="px-4 text-sm font-semibold text-foreground">
            eRačun i fiskalizacija
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="eracun_dostava_kanal">Kanal dostave</Label>
                <Input
                  id="eracun_dostava_kanal"
                  value={formData.eracun_dostava_kanal}
                  onChange={(event) =>
                    updateForm("eracun_dostava_kanal", event.target.value)
                  }
                  placeholder="npr. PEPPOL, Fina"
                />
              </div>
              <div>
                <Label htmlFor="eracun_identifikator">Identifikator</Label>
                <Input
                  id="eracun_identifikator"
                  value={formData.eracun_identifikator}
                  onChange={(event) =>
                    updateForm("eracun_identifikator", event.target.value)
                  }
                  placeholder="npr. HR:12345678901"
                />
              </div>
              <div>
                <Label htmlFor="eracun_email">eRačun email</Label>
                <Input
                  id="eracun_email"
                  type="email"
                  value={formData.eracun_email}
                  onChange={(event) =>
                    updateForm("eracun_email", event.target.value)
                  }
                  placeholder="npr. eracun@primatelj.hr"
                />
              </div>
              <div>
                <Label htmlFor="eracun_posrednik">Posrednik</Label>
                <Input
                  id="eracun_posrednik"
                  value={formData.eracun_posrednik}
                  onChange={(event) =>
                    updateForm("eracun_posrednik", event.target.value)
                  }
                  placeholder="npr. Fina, Moj-eRačun"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fiskalizacija_napomena">
                Napomena za fiskalizaciju / eRačun
              </Label>
              <Textarea
                id="fiskalizacija_napomena"
                rows={3}
                value={formData.fiskalizacija_napomena}
                onChange={(event) =>
                  updateForm("fiskalizacija_napomena", event.target.value)
                }
                placeholder="Kontrolne napomene, npr. zahtjev za posebnim certifikatom"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="notes"
          className="border-border/60 last:border-b-0"
        >
          <AccordionTrigger className="px-4 text-sm font-semibold text-foreground">
            Operativne bilješke
          </AccordionTrigger>
          <AccordionContent className="space-y-3 px-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="radno_vrijeme">Radno vrijeme</Label>
                <Input
                  id="radno_vrijeme"
                  value={formData.radno_vrijeme}
                  onChange={(event) =>
                    updateForm("radno_vrijeme", event.target.value)
                  }
                  placeholder="npr. Pon-Pet 08-16"
                />
              </div>
              <div>
                <Label htmlFor="biljeske">Bilješke</Label>
                <Textarea
                  id="biljeske"
                  value={formData.biljeske}
                  onChange={(event) =>
                    updateForm("biljeske", event.target.value)
                  }
                  rows={3}
                  placeholder="Interna napomena, SLA dogovor..."
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Dodatni kontakti
            </h4>
            <p className="text-xs text-muted-foreground">
              Koristite za alternative ili specijalizirane kontakte.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddContact}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Dodaj kontakt
          </Button>
        </div>

        {extraContacts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
            Trenutno nema dodatnih kontakata.
          </div>
        ) : (
          <div className="space-y-3">
            {extraContacts.map((kontakt) => (
              <div
                key={kontakt.localId}
                className="space-y-3 rounded-lg border border-border/60 bg-white/80 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {kontakt.ime || "Kontakt"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveContact(kontakt.localId)}
                    aria-label="Ukloni kontakt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Ime *</Label>
                    <Input
                      value={kontakt.ime}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "ime",
                          event.target.value,
                        )
                      }
                      placeholder="Ime i prezime"
                    />
                  </div>
                  <div>
                    <Label>Uloga</Label>
                    <Input
                      value={kontakt.uloga}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "uloga",
                          event.target.value,
                        )
                      }
                      placeholder="npr. Voditelj servisa"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={kontakt.email}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "email",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Telefon</Label>
                    <Input
                      value={kontakt.telefon}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "telefon",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Preferirani kanal</Label>
                    <Input
                      value={kontakt.preferirani_kanal}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "preferirani_kanal",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Odziv (h)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={kontakt.hitnost_odziva_sati}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "hitnost_odziva_sati",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Napomena</Label>
                    <Textarea
                      value={kontakt.napomena}
                      onChange={(event) =>
                        handleContactChange(
                          kontakt.localId,
                          "napomena",
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="potvrdi-zakupnik-form"
          disabled={submitting}
        >
          {submitting
            ? "Spremam..."
            : zakupnik
              ? "Spremi promjene"
              : isPartner
                ? "Kreiraj partnera"
                : "Kreiraj zakupnika"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="odustani-zakupnik-form"
          disabled={submitting}
        >
          Odustani
        </Button>
      </div>
    </form>
  );
};

// Ugovori Component
const Ugovori = () => {
  const {
    ugovori,
    nekretnine,
    zakupnici,
    dokumenti,
    propertyUnitsByProperty,
    propertyUnitsById,
    loading: storeLoading,
    error: storeError,
    refresh: refreshEntities,
  } = useEntityStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("aktivno");
  const [renewalTemplate, setRenewalTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const {
    logs: contractAuditLogs,
    loading: contractAuditLoading,
    error: contractAuditError,
  } = useAuditTimeline("lease", editingContract?.id, {
    limit: 20,
    enabled: Boolean(editingContract?.id),
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get("action") === "renew") {
      const template = sessionStorage.getItem("renewalTemplate");
      if (template) {
        setRenewalTemplate(JSON.parse(template));
        setShowCreateForm(true);
        sessionStorage.removeItem("renewalTemplate");
      }
    }
  }, [location]);

  const nekretnineById = useMemo(
    () => Object.fromEntries(nekretnine.map((item) => [item.id, item])),
    [nekretnine],
  );
  const zakupniciById = useMemo(
    () => Object.fromEntries(zakupnici.map((item) => [item.id, item])),
    [zakupnici],
  );

  const handleSubmitUgovor = async (formData) => {
    if (isMutating) {
      return;
    }
    if (!formData?.property_unit_id) {
      toast.error("Ugovor mora biti povezan s podprostorom");
      return;
    }
    setIsMutating(true);
    try {
      if (editingContract) {
        await api.updateUgovor(editingContract.id, formData);
        toast.success("Ugovor je uspješno ažuriran");
      } else {
        await api.createUgovor(formData);
        toast.success("Ugovor je uspješno kreiran");
      }
      setShowCreateForm(false);
      setRenewalTemplate(null);
      setEditingContract(null);
      try {
        await refreshEntities();
      } catch (refreshError) {
        console.error(
          "Greška pri osvježavanju ugovora nakon spremanja:",
          refreshError,
        );
        toast.warning(
          "Ugovor je spremljen, ali prikaz nije automatski osvježen.",
        );
      }
    } catch (error) {
      console.error("Greška pri spremanju ugovora:", error);
      toast.error("Spremanje ugovora nije uspjelo");
    } finally {
      setIsMutating(false);
    }
  };

  const handleStatusChange = async (ugovorId, noviStatus) => {
    try {
      await api.updateStatusUgovora(ugovorId, noviStatus);
      toast.success("Status ugovora je ažuriran");
      await refreshEntities();
    } catch (error) {
      console.error("Greška pri ažuriranju statusa:", error);
      toast.error("Greška pri ažuriranju statusa");
    }
  };

  const getNekretnina = useCallback(
    (nekretninaId) => nekretnineById[nekretninaId],
    [nekretnineById],
  );

  const getZakupnik = useCallback(
    (zakupnikId) => zakupniciById[zakupnikId],
    [zakupniciById],
  );

  const getDocumentUrl = useCallback(
    (dokument) => buildDocumentUrl(dokument),
    [],
  );

  const getStatusBadge = (status) => {
    const statusMap = {
      aktivno: { label: "Aktivno", variant: "default" },
      na_isteku: { label: "Na isteku", variant: "secondary" },
      raskinuto: { label: "Raskinuto", variant: "destructive" },
      arhivirano: { label: "Arhivirano", variant: "outline" },
    };

    const statusInfo = statusMap[status] || {
      label: status,
      variant: "outline",
    };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const handleDownloadContractDocument = (dokument) => {
    const url = getDocumentUrl(dokument);
    if (!url) {
      toast.error("PDF nije dostupan za ovaj dokument");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const handlePreviewContractDocument = (dokument) => {
    setPreviewDocument(dokument);
    setShowPreviewDialog(true);
  };

  const archivedStatuses = ARCHIVED_CONTRACT_STATUSES;
  const activeContractsCount = useMemo(
    () => ugovori.filter((u) => u.status === "aktivno").length,
    [ugovori],
  );
  const archivedContractsCount = useMemo(
    () => ugovori.filter((u) => archivedStatuses.has(u.status)).length,
    [ugovori],
  );
  const expiringContractsCount = useMemo(
    () =>
      ugovori.filter((u) => u.status === "aktivno" && isContractExpiring(u))
        .length,
    [ugovori],
  );
  const loading = storeLoading && ugovori.length === 0;
  const refreshingStore = storeLoading && ugovori.length > 0;

  const filteredUgovori = ugovori.filter((ugovor) => {
    // Prvo filtriraj po statusu
    let matches = true;
    if (filterStatus !== "svi") {
      if (filterStatus === "na_isteku") {
        matches = ugovor.status === "aktivno" && isUgovorNaIsteku(ugovor);
      } else if (filterStatus === "arhivirano") {
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

      matches =
        ugovor.interna_oznaka.toLowerCase().includes(query) ||
        nekretnina?.naziv.toLowerCase().includes(query) ||
        nekretnina?.adresa.toLowerCase().includes(query) ||
        zakupnik?.naziv_firme?.toLowerCase().includes(query) ||
        zakupnik?.ime_prezime?.toLowerCase().includes(query) ||
        zakupnik?.oib.includes(query) ||
        zakupnik?.pdv_id?.toLowerCase().includes(query) ||
        zakupnik?.eracun_identifikator?.toLowerCase().includes(query);
    }

    return matches;
  });

  if (loading) {
    return <div className="p-8">Učitava ugovore...</div>;
  }

  if (storeError && !ugovori.length) {
    return (
      <div className="px-6 py-10 text-sm text-destructive">
        Greška pri učitavanju ugovora. Pokušajte ponovno kasnije.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {refreshingStore && (
        <div className="text-xs text-muted-foreground/70">
          Osvježavanje podataka...
        </div>
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
          variant={filterStatus === "svi" ? "default" : "outline"}
          onClick={() => setFilterStatus("svi")}
          size="sm"
        >
          Svi ({ugovori.length})
        </Button>
        <Button
          variant={filterStatus === "aktivno" ? "default" : "outline"}
          onClick={() => setFilterStatus("aktivno")}
          size="sm"
        >
          Aktivni ({activeContractsCount})
        </Button>
        <Button
          variant={filterStatus === "na_isteku" ? "default" : "outline"}
          onClick={() => setFilterStatus("na_isteku")}
          size="sm"
          className="bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          <Bell className="w-4 h-4 mr-1" />
          Na isteku ({expiringContractsCount})
        </Button>
        <Button
          variant={filterStatus === "arhivirano" ? "default" : "outline"}
          onClick={() => setFilterStatus("arhivirano")}
          size="sm"
        >
          Arhivirani ({archivedContractsCount})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredUgovori.map((ugovor) => {
          const nekretnina = getNekretnina(ugovor.nekretnina_id);
          const zakupnik = getZakupnik(ugovor.zakupnik_id);
          const naIsteku = isContractExpiring(ugovor);
          const contractDocuments = documentsByContract[ugovor.id] || [];
          const propertyUnit = ugovor.property_unit_id
            ? propertyUnitsById?.[ugovor.property_unit_id]
            : null;
          const propertyUnitLabel = propertyUnit
            ? getUnitDisplayName(propertyUnit)
            : null;
          const propertyUnitStatus = propertyUnit
            ? formatUnitStatus(propertyUnit.status)
            : null;

          return (
            <Card
              key={ugovor.id}
              className={naIsteku ? "border-orange-200 bg-orange-50" : ""}
              data-testid={`ugovor-card-${ugovor.id}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {ugovor.interna_oznaka}
                  <div className="flex space-x-2">
                    {naIsteku && (
                      <Badge
                        variant="secondary"
                        className="bg-orange-200 text-orange-800"
                      >
                        ⚠️ Ističe uskoro
                      </Badge>
                    )}
                    {getStatusBadge(ugovor.status)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-blue-600">
                    {nekretnina?.naziv}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nekretnina?.adresa}
                  </p>
                </div>
                <div>
                  <p className="font-medium">
                    {zakupnik?.naziv_firme || zakupnik?.ime_prezime}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    OIB: {zakupnik?.oib}
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    PDV: {formatBooleanish(zakupnik?.pdv_obveznik)}
                    {zakupnik?.pdv_id ? ` • ID: ${zakupnik.pdv_id}` : ""}
                  </p>
                  {(zakupnik?.eracun_identifikator ||
                    zakupnik?.eracun_dostava_kanal ||
                    zakupnik?.eracun_posrednik) && (
                    <p className="text-xs text-muted-foreground/70">
                      eRačun: {zakupnik?.eracun_identifikator || "—"}
                      {zakupnik?.eracun_dostava_kanal
                        ? ` • Kanal: ${zakupnik.eracun_dostava_kanal}`
                        : ""}
                      {zakupnik?.eracun_posrednik
                        ? ` • Posrednik: ${zakupnik.eracun_posrednik}`
                        : ""}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Podprostor: {propertyUnitLabel || "—"}
                  </p>
                  {propertyUnit && (
                    <p className="text-xs text-muted-foreground">
                      {propertyUnitStatus}
                      {propertyUnit.povrsina_m2
                        ? ` • ${propertyUnit.povrsina_m2} m²`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Početak:</span>{" "}
                    {new Date(ugovor.datum_pocetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Završetak:</span>{" "}
                    {new Date(ugovor.datum_zavrsetka).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Trajanje:</span>{" "}
                    {ugovor.trajanje_mjeseci} mj.
                  </div>
                  <div>
                    <span className="font-medium">Otkaz:</span>{" "}
                    {ugovor.rok_otkaza_dani} dana
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
                        <li
                          key={dokument.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span
                            className="truncate mr-2"
                            title={dokument.naziv}
                          >
                            {dokument.naziv}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handlePreviewContractDocument(dokument)
                              }
                              disabled={!dokument.putanja_datoteke}
                              className="h-8 w-8"
                              data-testid={`ugovor-doc-preview-${dokument.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDownloadContractDocument(dokument)
                              }
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
                    onValueChange={(value) =>
                      handleStatusChange(ugovor.id, value)
                    }
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
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="ugovor-form-description"
        >
          <DialogHeader>
            <DialogTitle>
              {editingContract
                ? "Uredi ugovor"
                : renewalTemplate
                  ? "Produžetak ugovora - Nova interna oznaka"
                  : "Dodaj novi ugovor"}
            </DialogTitle>
          </DialogHeader>
          <div id="ugovor-form-description" className="sr-only">
            {editingContract
              ? "Forma za uređivanje postojećeg ugovora o zakupu"
              : "Forma za kreiranje novog ugovora o zakupu"}
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
            auditTimeline={contractAuditLogs}
            auditLoading={contractAuditLoading}
            auditError={contractAuditError}
            submitting={isMutating}
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
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          aria-describedby="ugovor-document-preview-description"
        >
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
                  <span className="font-medium text-primary">Naziv:</span>{" "}
                  {previewDocument.naziv}
                </div>
                <div>
                  <span className="font-medium text-primary">Tip:</span>{" "}
                  {formatDocumentType(previewDocument.tip)}
                </div>
                <div>
                  <span className="font-medium text-primary">Datum:</span>{" "}
                  {new Date(previewDocument.kreiran).toLocaleDateString(
                    "hr-HR",
                  )}
                </div>
                {previewDocument.opis && (
                  <div>
                    <span className="font-medium text-primary">Opis:</span>
                    <p className="text-muted-foreground">
                      {previewDocument.opis}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = getDocumentUrl(previewDocument);
                    if (!url) {
                      toast.error("PDF datoteka nije dostupna.");
                      return;
                    }
                    window.open(url, "_blank", "noopener");
                  }}
                  disabled={!getDocumentUrl(previewDocument)}
                >
                  <Download className="w-4 h-4 mr-2" /> Otvori u novom prozoru
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const holder = document.querySelector(
                      "[data-document-preview]",
                    );
                    const iframe = holder
                      ? holder.querySelector("iframe")
                      : null;
                    const url = getDocumentUrl(previewDocument);
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                      return;
                    }
                    if (url) {
                      const printWindow = window.open(
                        url,
                        "_blank",
                        "noopener",
                      );
                      if (printWindow) {
                        printWindow.addEventListener(
                          "load",
                          () => printWindow.print(),
                          { once: true },
                        );
                      }
                    } else {
                      toast.error("PDF datoteka nije učitana za ovaj dokument");
                    }
                  }}
                  disabled={!getDocumentUrl(previewDocument)}
                >
                  <Printer className="w-4 h-4 mr-2" /> Ispiši
                </Button>
              </div>
              <DocumentViewer
                dokument={previewDocument}
                heightClass="h-[65vh]"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Ugovor Form Component
const UgovorForm = ({
  nekretnine,
  zakupnici,
  propertyUnitsByProperty = {},
  propertyUnitsById = {},
  onSubmit,
  onCancel,
  renewalTemplate,
  contract = null,
  refreshEntities = async () => {},
  auditTimeline = [],
  auditLoading = false,
  auditError = null,
  submitting = false,
}) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [formData, setFormData] = useState({
    interna_oznaka: "",
    nekretnina_id: "",
    zakupnik_id: "",
    datum_potpisivanja: "",
    datum_pocetka: "",
    datum_zavrsetka: "",
    trajanje_mjeseci: "",
    rok_otkaza_dani: 30,
    osnovna_zakupnina: "",
    zakupnina_po_m2: "",
    cam_troskovi: "",
    polog_depozit: "",
    garancija: "",
    indeksacija: false,
    indeks: "",
    formula_indeksacije: "",
    obveze_odrzavanja: "",
    namjena_prostora: "",
    rezije_brojila: "",
    property_unit_id: "",
  });
  const [tenantOptions, setTenantOptions] = useState(zakupnici);
  const latestCreatedUnitRef = useRef(null);
  const activeTenantOptions = useMemo(
    () =>
      tenantOptions.filter(
        (tenant) => (tenant.status || "aktivan") !== "arhiviran",
      ),
    [tenantOptions],
  );

  const tenantsById = useMemo(
    () => Object.fromEntries(zakupnici.map((tenant) => [tenant.id, tenant])),
    [zakupnici],
  );

  const unitsForSelectedProperty = useMemo(() => {
    if (!formData.nekretnina_id) {
      return [];
    }
    return sortUnitsByPosition(
      propertyUnitsByProperty[formData.nekretnina_id] || [],
    );
  }, [formData.nekretnina_id, propertyUnitsByProperty]);

  const manualUnitStatusOptions = useMemo(
    () =>
      Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    [],
  );

  const normaliseDateInput = useCallback((value) => {
    if (!value) {
      return "";
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
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
      interna_oznaka: contract.interna_oznaka || "",
      nekretnina_id: contract.nekretnina_id || "",
      zakupnik_id: contract.zakupnik_id || "",
      datum_potpisivanja: normaliseDateInput(contract.datum_potpisivanja),
      datum_pocetka: normaliseDateInput(contract.datum_pocetka),
      datum_zavrsetka: normaliseDateInput(contract.datum_zavrsetka),
      trajanje_mjeseci:
        contract.trajanje_mjeseci != null
          ? contract.trajanje_mjeseci.toString()
          : "",
      rok_otkaza_dani:
        contract.rok_otkaza_dani != null
          ? contract.rok_otkaza_dani.toString()
          : "30",
      osnovna_zakupnina:
        contract.osnovna_zakupnina != null
          ? contract.osnovna_zakupnina.toString()
          : "",
      zakupnina_po_m2:
        contract.zakupnina_po_m2 != null
          ? contract.zakupnina_po_m2.toString()
          : "",
      cam_troskovi:
        contract.cam_troskovi != null ? contract.cam_troskovi.toString() : "",
      polog_depozit:
        contract.polog_depozit != null ? contract.polog_depozit.toString() : "",
      garancija:
        contract.garancija != null ? contract.garancija.toString() : "",
      indeksacija: contract.indeksacija ?? false,
      indeks: contract.indeks || "",
      formula_indeksacije: contract.formula_indeksacije || "",
      obveze_odrzavanja: contract.obveze_odrzavanja || "",
      namjena_prostora: contract.namjena_prostora || "",
      rezije_brojila: contract.rezije_brojila || "",
      property_unit_id: contract.property_unit_id || "",
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
      latestCreatedUnitRef.current &&
      latestCreatedUnitRef.current.id === formData.property_unit_id
        ? latestCreatedUnitRef.current
        : null;
    const unit = propertyUnitsById?.[formData.property_unit_id] || fallbackUnit;
    if (!unit) {
      setFormData((prev) => ({ ...prev, property_unit_id: "" }));
      return;
    }
    if (
      formData.nekretnina_id &&
      unit.nekretnina_id !== formData.nekretnina_id
    ) {
      setFormData((prev) => ({ ...prev, property_unit_id: "" }));
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
      latestCreatedUnitRef.current &&
      latestCreatedUnitRef.current.id === formData.property_unit_id
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

  const normalize = (value) => (value || "").toString().trim().toLowerCase();

  const findTenantMatch = useCallback(
    (suggestion) => {
      if (!suggestion) {
        return null;
      }
      const targetOib = normalize(suggestion.oib);
      const targetName = normalize(
        suggestion.naziv_firme || suggestion.ime_prezime,
      );
      if (!targetOib && !targetName) {
        return null;
      }
      return (
        tenantOptions.find((tenant) => {
          const tenantOib = normalize(tenant.oib);
          const tenantName = normalize(
            tenant.naziv_firme || tenant.ime_prezime,
          );
          if (targetOib && tenantOib && tenantOib === targetOib) {
            return true;
          }
          if (targetName && tenantName === targetName) {
            return true;
          }
          return false;
        }) || null
      );
    },
    [tenantOptions],
  );

  const findPropertyMatch = useCallback(
    (suggestion) => {
      if (!suggestion) {
        return null;
      }
      const targetName = normalize(suggestion.naziv);
      const targetAddress = normalize(suggestion.adresa);
      if (!targetName && !targetAddress) {
        return null;
      }
      return (
        nekretnine.find((property) => {
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
        }) || null
      );
    },
    [nekretnine],
  );

  const findPropertyUnitMatch = useCallback(
    (propertyId, suggestion) => {
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
    },
    [propertyUnitsByProperty],
  );

  const createTenantFromSuggestion = useCallback(
    async (suggestion) => {
      try {
        const payload = {
          naziv_firme: suggestion.naziv_firme || null,
          ime_prezime: suggestion.ime_prezime || null,
          oib: suggestion.oib || `N/A-${Date.now()}`,
          sjediste: suggestion.sjediste || "Nije navedeno",
          kontakt_ime:
            suggestion.kontakt_ime ||
            suggestion.naziv_firme ||
            suggestion.ime_prezime ||
            "Kontakt osoba",
          kontakt_email: suggestion.kontakt_email || "kontakt@nedefinirano.hr",
          kontakt_telefon: suggestion.kontakt_telefon || "000-000-000",
          iban: suggestion.iban || "",
          status: "aktivan",
        };
        const response = await api.createZakupnik(payload);
        const created = response.data;
        if (created?.id) {
          setTenantOptions((prev) =>
            prev.some((item) => item.id === created.id)
              ? prev
              : [...prev, created],
          );
          setFormData((prev) => ({ ...prev, zakupnik_id: created.id }));
          await refreshEntities();
          toast.success("Zakupnik je automatski kreiran iz PDF-a.");
          return created;
        }
      } catch (error) {
        console.error("Greška pri automatskom kreiranju zakupnika:", error);
        toast.error(
          "Zakupnika nije moguće automatski kreirati. Unesite podatke ručno.",
        );
      }
      return null;
    },
    [refreshEntities],
  );

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
        zakupnina_po_m2: renewalTemplate.zakupnina_po_m2?.toString() || "",
        cam_troskovi: renewalTemplate.cam_troskovi?.toString() || "",
        polog_depozit: renewalTemplate.polog_depozit?.toString() || "",
        garancija: renewalTemplate.garancija?.toString() || "",
        indeksacija: renewalTemplate.indeksacija,
        indeks: renewalTemplate.indeks || "",
        formula_indeksacije: renewalTemplate.formula_indeksacije || "",
        obveze_odrzavanja: renewalTemplate.obveze_odrzavanja || "",
        namjena_prostora: renewalTemplate.namjena_prostora || "",
        rezije_brojila: renewalTemplate.rezije_brojila || "",
      });
    }
  }, [renewalTemplate, contract]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setUploadedFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("Molimo odaberite PDF datoteku");
      event.target.value = "";
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    setIsParsing(true);
    toast.dismiss("contract-pdf-parse");
    toast.loading("Analiziram PDF ugovora…", {
      description: file.name,
      id: "contract-pdf-parse",
    });

    try {
      const response = await api.parsePdfContract(file);

      if (!response.data.success) {
        const serverMessage = response.data.message || "";
        const lowerMessage = serverMessage.toLowerCase();
        const aiUnavailable =
          lowerMessage.includes("openai_api_key") ||
          lowerMessage.includes("openai") ||
          lowerMessage.includes("analizi pdf-a");
        console.warn("AI analiza nije uspjela:", serverMessage, response.data);
        if (aiUnavailable) {
          toast.info(
            "AI analiza trenutno nije dostupna. Podatke možete unijeti ručno.",
          );
        } else {
          toast.error(serverMessage || "Greška pri analizi PDF-a");
        }
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
      const tenantMatchStatus = tenantMatch
        ? tenantMatch.status || "aktivan"
        : null;
      const tenantMatchIsArchived = tenantMatchStatus === "arhiviran";

      let inferredPropertyUnitId = "";

      if (
        createdPropertyUnit &&
        propertyMatch &&
        createdPropertyUnit.nekretnina_id === propertyMatch.id
      ) {
        latestCreatedUnitRef.current = createdPropertyUnit;
        inferredPropertyUnitId = createdPropertyUnit.id;
        await refreshEntities();
        toast.success(
          `Podprostor ${createdPropertyUnit.oznaka || createdPropertyUnit.naziv || createdPropertyUnit.id} je automatski kreiran.`,
        );
      } else if (
        matchedPropertyUnit &&
        propertyMatch &&
        matchedPropertyUnit.nekretnina_id === propertyMatch.id
      ) {
        inferredPropertyUnitId = matchedPropertyUnit.id;
        toast.success(
          `Podprostor ${matchedPropertyUnit.oznaka || matchedPropertyUnit.naziv || matchedPropertyUnit.id} je povezan s ugovorom.`,
        );
      } else if (
        propertyMatch &&
        (propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv)
      ) {
        const localMatch = findPropertyUnitMatch(
          propertyMatch.id,
          propertyUnitSuggestion,
        );
        if (localMatch) {
          inferredPropertyUnitId = localMatch.id;
          toast.info(
            `Podprostor ${localMatch.oznaka || localMatch.naziv} je povezan s ugovorom.`,
          );
        } else {
          toast.warning(
            `AI je identificirao podprostor ${propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv}, ali nije pronađen u sustavu.`,
          );
        }
      } else if (
        (propertyUnitSuggestion.oznaka || propertyUnitSuggestion.naziv) &&
        !propertyMatch
      ) {
        toast.info(
          "AI je prepoznao podprostor, ali nije pronašao odgovarajuću nekretninu.",
        );
      }

      setFormData((prevData) => {
        const nextData = {
          ...prevData,
          interna_oznaka: ugovor.interna_oznaka || prevData.interna_oznaka,
          datum_potpisivanja:
            ugovor.datum_potpisivanja || prevData.datum_potpisivanja,
          datum_pocetka: ugovor.datum_pocetka || prevData.datum_pocetka,
          datum_zavrsetka: ugovor.datum_zavrsetka || prevData.datum_zavrsetka,
          trajanje_mjeseci:
            ugovor.trajanje_mjeseci?.toString() || prevData.trajanje_mjeseci,
          rok_otkaza_dani: ugovor.rok_otkaza_dani || prevData.rok_otkaza_dani,
          osnovna_zakupnina:
            financije.osnovna_zakupnina?.toString() ||
            prevData.osnovna_zakupnina,
          zakupnina_po_m2:
            financije.zakupnina_po_m2?.toString() || prevData.zakupnina_po_m2,
          cam_troskovi:
            financije.cam_troskovi?.toString() || prevData.cam_troskovi,
          polog_depozit:
            financije.polog_depozit?.toString() || prevData.polog_depozit,
          garancija: financije.garancija?.toString() || prevData.garancija,
          indeksacija:
            financije.indeksacija !== null
              ? financije.indeksacija
              : prevData.indeksacija,
          indeks: financije.indeks || prevData.indeks,
          formula_indeksacije:
            financije.formula_indeksacije || prevData.formula_indeksacije,
          obveze_odrzavanja:
            ostalo.obveze_odrzavanja || prevData.obveze_odrzavanja,
          namjena_prostora:
            parsedData.nekretnina?.namjena_prostora ||
            prevData.namjena_prostora,
          rezije_brojila: ostalo.rezije_brojila || prevData.rezije_brojila,
          nekretnina_id: propertyMatch
            ? propertyMatch.id
            : prevData.nekretnina_id,
          zakupnik_id:
            tenantMatch && !tenantMatchIsArchived
              ? tenantMatch.id
              : prevData.zakupnik_id,
        };

        if (inferredPropertyUnitId) {
          nextData.property_unit_id = inferredPropertyUnitId;
        }

        return nextData;
      });

      if (
        (!tenantMatch || tenantMatchIsArchived) &&
        (tenantSuggestion.naziv_firme || tenantSuggestion.ime_prezime)
      ) {
        await createTenantFromSuggestion(tenantSuggestion);
      }

      toast.success("PDF ugovor je analiziran i podaci su uneseni u formu!");
    } catch (error) {
      console.error("Greška pri analizi PDF-a:", error);
      toast.info("AI analiza nije uspjela. Podatke možete unijeti ručno.");
    } finally {
      toast.dismiss("contract-pdf-parse");
      setIsParsing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    document.getElementById("pdf-upload").value = "";
    setFormData((prev) => ({ ...prev, file: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    if (!formData.property_unit_id) {
      toast.error("Odaberite podprostor prije spremanja ugovora");
      return;
    }
    const data = {
      ...formData,
      trajanje_mjeseci: parseInt(formData.trajanje_mjeseci),
      rok_otkaza_dani: parseInt(formData.rok_otkaza_dani),
      osnovna_zakupnina: parseFloat(formData.osnovna_zakupnina),
      zakupnina_po_m2: formData.zakupnina_po_m2
        ? parseFloat(formData.zakupnina_po_m2)
        : null,
      cam_troskovi: formData.cam_troskovi
        ? parseFloat(formData.cam_troskovi)
        : null,
      polog_depozit: formData.polog_depozit
        ? parseFloat(formData.polog_depozit)
        : null,
      garancija: formData.garancija ? parseFloat(formData.garancija) : null,
      property_unit_id: formData.property_unit_id,
    };

    // Ako je renewal, arhiviraj stari ugovor
    if (renewalTemplate?._isRenewal && renewalTemplate._oldContractId) {
      try {
        await api.updateStatusUgovora(
          renewalTemplate._oldContractId,
          "arhivirano",
        );
        toast.info("Stari ugovor je uspješno arhiviran");
      } catch (error) {
        console.error("Greška pri arhiviranju starog ugovora:", error);
        toast.warning(
          "Novi ugovor je kreiran, ali stari nije arhiviran automatski",
        );
      }
    }

    await onSubmit(data);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="ugovor-form"
    >
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
                disabled={isParsing || submitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("pdf-upload").click()}
                disabled={isParsing || submitting}
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
                disabled={isParsing || submitting}
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
                onChange={(e) =>
                  setFormData({ ...formData, interna_oznaka: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    datum_potpisivanja: e.target.value,
                  })
                }
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
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                nekretnina_id: value,
                property_unit_id:
                  value &&
                  prev.property_unit_id &&
                  propertyUnitsById?.[prev.property_unit_id]?.nekretnina_id ===
                    value
                    ? prev.property_unit_id
                    : "",
              }))
            }
            renderLabel={(nekretnina) =>
              `${nekretnina.naziv} - ${nekretnina.adresa}`
            }
            testId="ugovor-nekretnina-select"
            allowNone={false}
          />

          <LinkedEntitySelect
            label="Podprostor / jedinica *"
            placeholder={
              formData.nekretnina_id
                ? "Poveži podprostor"
                : "Odaberite nekretninu za popis jedinica"
            }
            entities={unitsForSelectedProperty}
            value={formData.property_unit_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, property_unit_id: value }))
            }
            renderLabel={(unit) =>
              `${getUnitDisplayName(unit)} • ${formatUnitStatus(unit.status)} • ${resolveUnitTenantName(unit, tenantsById)}`
            }
            testId="ugovor-unit-select"
            disabled={!formData.nekretnina_id}
            allowNone={false}
          />

          <LinkedEntitySelect
            label="Zakupnik *"
            placeholder="Izaberite zakupnika"
            entities={activeTenantOptions}
            value={formData.zakupnik_id}
            onChange={(value) =>
              setFormData({ ...formData, zakupnik_id: value })
            }
            renderLabel={(zakupnik) =>
              `${zakupnik.naziv_firme || zakupnik.ime_prezime} - ${zakupnik.oib}`
            }
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
                onChange={(e) =>
                  setFormData({ ...formData, datum_pocetka: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, datum_zavrsetka: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, trajanje_mjeseci: e.target.value })
                }
                data-testid="ugovor-trajanje-input"
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financije" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="osnovna_zakupnina">
                Osnovna zakupnina (€/mjesec) *
              </Label>
              <Input
                id="osnovna_zakupnina"
                type="number"
                step="0.01"
                value={formData.osnovna_zakupnina}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    osnovna_zakupnina: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, zakupnina_po_m2: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, cam_troskovi: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, polog_depozit: e.target.value })
                }
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
              onChange={(e) =>
                setFormData({ ...formData, garancija: e.target.value })
              }
              data-testid="ugovor-garancija-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="indeksacija"
                checked={formData.indeksacija}
                onChange={(e) =>
                  setFormData({ ...formData, indeksacija: e.target.checked })
                }
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
                    onChange={(e) =>
                      setFormData({ ...formData, indeks: e.target.value })
                    }
                    data-testid="ugovor-indeks-input"
                    placeholder="npr. potrošačke cijene"
                  />
                </div>
                <div>
                  <Label htmlFor="formula_indeksacije">Formula</Label>
                  <Input
                    id="formula_indeksacije"
                    value={formData.formula_indeksacije}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        formula_indeksacije: e.target.value,
                      })
                    }
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
                onChange={(e) =>
                  setFormData({ ...formData, rok_otkaza_dani: e.target.value })
                }
                data-testid="ugovor-otkaz-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="obveze_odrzavanja">Obveze održavanja</Label>
            <Select
              value={formData.obveze_odrzavanja}
              onValueChange={(value) =>
                setFormData({ ...formData, obveze_odrzavanja: value })
              }
            >
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
              onChange={(e) =>
                setFormData({ ...formData, namjena_prostora: e.target.value })
              }
              data-testid="ugovor-namjena-input"
              placeholder="npr. uredski prostor, trgovina"
            />
          </div>

          <div>
            <Label htmlFor="rezije_brojila">Režije i brojila</Label>
            <Textarea
              id="rezije_brojila"
              value={formData.rezije_brojila}
              onChange={(e) =>
                setFormData({ ...formData, rezije_brojila: e.target.value })
              }
              data-testid="ugovor-rezije-input"
              placeholder="Opišite režijske troškove i brojila"
            />
          </div>
        </TabsContent>
      </Tabs>

      {contract && (
        <AuditTimelinePanel
          className="mt-6 border-t border-border/60 pt-4"
          title="Povijest aktivnosti"
          logs={auditTimeline}
          loading={auditLoading}
          error={auditError}
          emptyMessage="Nema dostupnih audit zapisa za ovaj ugovor."
        />
      )}

      <div className="flex space-x-2 pt-4">
        <Button
          type="submit"
          data-testid="potvrdi-ugovor-form"
          disabled={submitting || isParsing}
        >
          {submitting
            ? "Spremam..."
            : renewalTemplate
              ? "Kreiraj produžetak"
              : "Kreiraj ugovor"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="odustani-ugovor-form"
          disabled={submitting}
        >
          Odustani
        </Button>
      </div>
    </form>
  );
};

const AppContent = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/10">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          Provjeravam korisničku sesiju…
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  return (
    <EntityStoreProvider>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nekretnine" element={<Nekretnine />} />
          <Route path="/zakupnici" element={<Zakupnici />} />
          <Route path="/ugovori" element={<Ugovori />} />
          <Route path="/odrzavanje" element={<MaintenanceWorkspace />} />
          <Route
            path="/dokumenti"
            element={
              <Suspense
                fallback={
                  <div className="p-6 text-sm text-muted-foreground">
                    Učitavanje dokumenata…
                  </div>
                }
              >
                <DocumentsPageLazy />
              </Suspense>
            }
          />
          <Route path="/profili" element={<TenantProfiles />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster />
    </EntityStoreProvider>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export {
  Dashboard,
  MaintenanceWorkspace,
  Zakupnici,
  EntityStoreContext,
  EntityStoreProvider,
};
export default App;
