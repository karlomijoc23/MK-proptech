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
import { Skeleton } from "./components/ui/skeleton";
import PageTransition from "./components/PageTransition";
import { AnimatePresence } from "framer-motion";
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
import DocumentWizard from "./features/documents/DocumentWizard";
import { UnitStatusMap } from "./features/properties";
import NekretninarForm from "./features/properties/NekretninarForm";
import NekretninePage from "./features/properties/NekretninePage";
import ZakupnikForm from "./features/tenants/ZakupnikForm";
import ContractReport from "./features/contracts/ContractReport";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import ZakupniciPage from "./features/tenants/ZakupniciPage";
import TenantProfiles from "./features/tenants/TenantProfiles";
import UgovoriPage from "./features/contracts/UgovoriPage";
import MaintenanceBoard, {
  MAINTENANCE_STATUS_META,
  MAINTENANCE_STATUS_ORDER,
  ALL_MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITY_CONFIG,
  MAINTENANCE_PRIORITY_ORDER,
  EMPTY_MAINTENANCE_FORM,
} from "./features/maintenance/MaintenanceBoard";
import LoginPage from "./features/auth/LoginPage";
import LinkedEntitySelect from "./components/LinkedEntitySelect";
import { TenantSwitcher } from "./components/TenantSwitcher";
import { Navigation } from "./components/Navigation";
import { ClickableReminder } from "./components/ClickableReminder";
import { AuditTimelinePanel } from "./components/AuditTimelinePanel";
import { useAuditTimeline } from "./hooks/useAuditTimeline";
import { dedupeRemindersById } from "./lib/utils";

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

// Navigation Component

// Clickable Reminder Component

// Dashboard Component
// Maintenance constants moved to features/maintenance/MaintenanceBoard.jsx

// MaintenanceBoard component moved to features/maintenance/MaintenanceBoard.jsx

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
  const { dokumenti, nekretnine, ugovori, zakupnici, maintenanceTasks } =
    useEntityStore();

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
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
    propertyUnitsById,
    maintenanceTasks,
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

  const [editingDocument, setEditingDocument] = useState(null);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  const handleDeleteDokument = async (docId) => {
    if (!window.confirm("Jeste li sigurni da želite obrisati ovaj dokument?")) {
      return;
    }
    try {
      await api.deleteDokument(docId);
      toast.success("Dokument uspješno obrisan");
      refreshEntities();
    } catch (error) {
      console.error("Greška pri brisanju dokumenta:", error);
      toast.error("Neuspješno brisanje dokumenta");
    }
  };

  const handleEditDokument = (doc) => {
    setEditingDocument(doc);
    setShowDocumentDialog(true);
  };

  const handleCreateDokument = async (formData) => {
    const toastId = toast.loading("Spremam dokument…");
    try {
      if (editingDocument) {
        await api.updateDokument(editingDocument.id, formData);
        toast.success("Dokument uspješno ažuriran", { id: toastId });
      } else {
        await api.createDokument(formData);
        toast.success("Dokument uspješno dodan", { id: toastId });
      }
      setShowDocumentDialog(false);
      setEditingDocument(null);
      refreshEntities();
    } catch (error) {
      console.error("Greška pri spremanju dokumenta:", error);
      toast.error("Neuspješno spremanje dokumenta", { id: toastId });
    }
  };

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
    const amortization =
      parseNumericValue(selectedNekretnina.amortizacija) || 0;
    const netIncome =
      netIncomeRaw !== null
        ? netIncomeRaw
        : grossIncome - operatingExpense + amortization;
    const maintenanceCost =
      parseNumericValue(selectedNekretnina.troskovi_odrzavanja) || 0;
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
          const amortization = parseNumericValue(nekretnina.amortizacija) || 0;
          const resolvedNetIncome =
            netIncomeRaw !== null
              ? netIncomeRaw
              : grossIncome - operatingExpense + amortization;
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
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditDokument(doc)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteDokument(doc.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
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

                <Card>
                  <CardHeader>
                    <CardTitle>Radni nalozi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const tasks = (maintenanceTasks || []).filter(
                        (t) => t.nekretnina_id === selectedNekretnina.id,
                      );

                      if (tasks.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            Nema zabilježenih radnih naloga za ovu nekretninu.
                          </p>
                        );
                      }

                      const activeTasks = tasks.filter(
                        (t) => t.status !== "arhivirano",
                      );
                      const archivedTasks = tasks.filter(
                        (t) => t.status === "arhivirano",
                      );

                      const renderTaskItem = (task) => (
                        <div
                          key={task.id}
                          className="flex flex-col gap-2 rounded-md border border-border/60 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                {task.naziv}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(task.kreiran)} • {task.prijavio}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  MAINTENANCE_STATUS_META[task.status]
                                    ?.badgeClass
                                }
                              >
                                {MAINTENANCE_STATUS_META[task.status]?.title ||
                                  task.status}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  MAINTENANCE_PRIORITY_CONFIG[task.prioritet]
                                    ?.className
                                }
                              >
                                {MAINTENANCE_PRIORITY_CONFIG[task.prioritet]
                                  ?.label || task.prioritet}
                              </Badge>
                            </div>
                          </div>
                          {task.opis && (
                            <p className="text-muted-foreground">{task.opis}</p>
                          )}
                        </div>
                      );

                      return (
                        <div className="space-y-6">
                          {activeTasks.length > 0 && (
                            <div className="space-y-2">
                              {activeTasks.map(renderTaskItem)}
                            </div>
                          )}

                          {archivedTasks.length > 0 && (
                            <details className="group">
                              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                <span>
                                  Arhivirani nalozi ({archivedTasks.length})
                                </span>
                                <div className="h-px flex-1 bg-border/60" />
                              </summary>
                              <div className="mt-3 space-y-2 pl-2 border-l-2 border-border/40">
                                {archivedTasks.map(renderTaskItem)}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
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

      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="dokument-form-description"
        >
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? "Uredi dokument" : "Dodaj novi dokument"}
            </DialogTitle>
          </DialogHeader>
          <div id="dokument-form-description" className="sr-only">
            Forma za {editingDocument ? "uređivanje" : "dodavanje"} dokumenta
          </div>
          <DocumentWizard
            nekretnine={nekretnine}
            zakupnici={zakupnici}
            ugovori={ugovori}
            propertyUnitsByProperty={propertyUnitsByProperty}
            propertyUnitsById={propertyUnitsById}
            onSubmit={handleCreateDokument}
            onCancel={() => setShowDocumentDialog(false)}
            refreshEntities={refreshEntities}
            loading={loading}
            initialData={editingDocument}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
// NekretninarForm imported from features/properties/NekretninarForm

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

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      if (editingDocument) {
        await api.updateDokument(editingDocument.id, {
          naziv: newDocument.naziv,
          tip: newDocument.tip,
          opis: newDocument.opis,
        });
        toast.success("Dokument uspješno ažuriran");
      } else {
        const payload = { ...newDocument };
        if (payload.nekretnina_id === "none") delete payload.nekretnina_id;
        if (payload.zakupnik_id === "none") delete payload.zakupnik_id;
        if (payload.ugovor_id === "none") delete payload.ugovor_id;

        await api.createDokument(payload);
        toast.success("Dokument uspješno dodan");
      }
      setShowDocumentDialog(false);
      setEditingDocument(null);
      setNewDocument({
        naziv: "",
        tip: "ostalo",
        opis: "",
        nekretnina_id: "none",
        zakupnik_id: "none",
        ugovor_id: "none",
        file: null,
      });
      refreshEntities();
    } catch (error) {
      console.error("Greška pri spremanju dokumenta:", error);
      toast.error("Neuspješno spremanje dokumenta");
    }
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

  const [editingDocument, setEditingDocument] = useState(null);

  const handleDeleteDokument = async (docId) => {
    if (!window.confirm("Jeste li sigurni da želite obrisati ovaj dokument?")) {
      return;
    }
    try {
      await api.deleteDokument(docId);
      toast.success("Dokument uspješno obrisan");
      refreshEntities();
    } catch (error) {
      console.error("Greška pri brisanju dokumenta:", error);
      toast.error("Neuspješno brisanje dokumenta");
    }
  };

  const handleEditDokument = (doc) => {
    setEditingDocument(doc);
    setNewDocument({
      naziv: doc.naziv,
      tip: doc.tip,
      opis: doc.opis || "",
      nekretnina_id: doc.nekretnina_id || "none",
      zakupnik_id: doc.zakupnik_id || "none",
      ugovor_id: doc.ugovor_id || "none",
      file: null,
    });
    setShowDocumentDialog(true);
  };
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
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              }
            />
            <Route
              path="/nekretnine"
              element={
                <PageTransition>
                  <NekretninePage />
                </PageTransition>
              }
            />
            <Route
              path="/zakupnici"
              element={
                <PageTransition>
                  <ZakupniciPage />
                </PageTransition>
              }
            />
            <Route
              path="/ugovori"
              element={
                <PageTransition>
                  <UgovoriPage />
                </PageTransition>
              }
            />
            <Route
              path="/ugovori/report"
              element={
                <PageTransition>
                  <ContractReport />
                </PageTransition>
              }
            />
            <Route path="/profili" element={<TenantProfiles />} />
            <Route
              path="/odrzavanje"
              element={
                <PageTransition>
                  <MaintenancePage />
                </PageTransition>
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
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
