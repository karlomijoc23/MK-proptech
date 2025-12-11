import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Progress } from "../../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "../../components/ui/sonner";
import {
  Building,
  FileText,
  DollarSign,
  Calendar,
  Bell,
  ArrowRight,
} from "lucide-react";
import { api } from "../../shared/api";
import { useEntityStore } from "../../shared/entityStore";
import {
  parseNumericValue,
  formatPercentage,
  formatDeltaPercentage,
  formatArea,
  formatPropertyType,
} from "../../shared/formatters";
import { ClickableReminder } from "../../components/ClickableReminder";
import { dedupeRemindersById } from "../../lib/utils";

const ARCHIVED_CONTRACT_STATUSES = new Set(["arhivirano", "raskinuto"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [activeReminders, setActiveReminders] = useState([]);
  const [allReminders, setAllReminders] = useState([]);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [remindersFilter, setRemindersFilter] = useState("svi");
  const [reminderSearch, setReminderSearch] = useState("");
  const { nekretnine, ugovori, zakupnici } = useEntityStore();

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

export default Dashboard;
