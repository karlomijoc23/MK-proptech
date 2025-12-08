import React, { useState, useMemo, useEffect } from "react";
import { useEntityStore } from "../../shared/entityStore";
import { api, buildDocumentUrl } from "../../shared/api";
import { toast } from "../../components/ui/sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Calendar,
  Users,
  AlertCircle,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Archive,
  Printer,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Download,
  Building,
  DollarSign,
  Eye,
  Edit,
  FileSignature,
  ArrowRight,
} from "lucide-react";
import { formatDate, formatCurrency } from "../../shared/formatters";
import { getUnitDisplayName } from "../../shared/units";
import UgovorForm from "./UgovorForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { useNavigate } from "react-router-dom";
import { generatePdf } from "../../shared/pdfGenerator";
import ContractPrintTemplate from "./ContractPrintTemplate";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Separator } from "../../components/ui/separator";
import { ScrollArea } from "../../components/ui/scroll-area";
import { EmptyState } from "../../components/ui/empty-state";

const UgovoriPage = () => {
  const navigate = useNavigate();
  const {
    ugovori,
    refresh: refreshUgovori,
    loading,
    nekretnine,
    zakupnici,
    propertyUnits,
  } = useEntityStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUgovor, setSelectedUgovor] = useState(null);
  const [filterProperty, setFilterProperty] = useState("all");

  // New state for details and archive
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewContract, setViewContract] = useState(null);

  // Deep link support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contractId = params.get("contractId");
    if (contractId && ugovori.length > 0) {
      const target = ugovori.find((c) => c.id === contractId);
      if (target) {
        setViewContract(target);
        setDetailsOpen(true);
        // Optional: clear param so refresh doesn't reopen, but keeping it is also fine for bookmarking
      }
    }
  }, [ugovori, window.location.search]);
  const [showArchive, setShowArchive] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);

  const printRef = React.useRef();

  // Fetch all documents for the main table view
  useEffect(() => {
    const fetchAllDocs = async () => {
      try {
        const res = await api.getDokumenti();
        setAllDocuments(res.data || []);
      } catch (err) {
        console.error("Failed to fetch all documents", err);
      }
    };
    fetchAllDocs();
  }, []);

  // Group documents by contract ID for quick lookup
  const docsByContract = useMemo(() => {
    const docs = {};
    allDocuments.forEach((doc) => {
      if (doc.ugovor_id) {
        if (!docs[doc.ugovor_id]) {
          docs[doc.ugovor_id] = {};
        }
        if (doc.tip === "ugovor") {
          docs[doc.ugovor_id].contract = doc;
        } else if (doc.tip === "primopredajni_zapisnik") {
          docs[doc.ugovor_id].protocol = doc;
        }
      }
    });
    return docs;
  }, [allDocuments]);

  React.useEffect(() => {
    if (viewContract && detailsOpen) {
      const fetchDocs = async () => {
        try {
          const res = await api.getDokumentiUgovora(viewContract.id);
          setDocuments(res.data || []);
        } catch (err) {
          console.error("Failed to fetch contract documents", err);
        }
      };
      fetchDocs();
    } else {
      setDocuments([]);
    }
  }, [viewContract, detailsOpen]);

  const handleCreate = () => {
    setSelectedUgovor(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (ugovor) => {
    setSelectedUgovor(ugovor);
    setIsDialogOpen(true);
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    refreshUgovori();
  };

  const handleStatusChange = async (ugovor, newStatus) => {
    try {
      await api.updateStatusUgovora(ugovor.id, newStatus);
      toast.success(
        `Status ugovora promijenjen u ${newStatus}. ${newStatus === "raskinuto" || newStatus === "arhivirano" ? 'Ako je ugovor nestao, provjerite filter "Prikaži arhivu".' : ""}`,
      );
      refreshUgovori();
    } catch (error) {
      console.error("Greška pri promjeni statusa:", error);
      toast.error("Promjena statusa nije uspjela");
    }
  };

  const isExpiring = (date) => {
    if (!date) return false;
    const today = new Date();
    const expiry = new Date(date);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  };

  const isExpired = (date) => {
    if (!date) return false;
    const today = new Date();
    const expiry = new Date(date);
    return expiry < today;
  };

  const filteredUgovori = useMemo(() => {
    let filtered = ugovori;

    // Filter by property
    if (filterProperty !== "all") {
      filtered = filtered.filter((u) => u.nekretnina_id === filterProperty);
    }

    // Filter by archive status
    if (!showArchive) {
      filtered = filtered.filter(
        (u) => u.status !== "arhivirano" && u.status !== "raskinuto",
      );
    } else {
      filtered = filtered.filter(
        (u) => u.status === "arhivirano" || u.status === "raskinuto",
      );
    }

    return filtered;
  }, [ugovori, filterProperty, showArchive]);

  const handlePrint = async () => {
    try {
      await generatePdf(
        printRef.current,
        `izvjestaj_ugovori_${new Date().toISOString().split("T")[0]}`,
        "landscape",
      );
      toast.success("Izvještaj je generiran");
    } catch (error) {
      toast.error("Greška pri generiranju izvještaja");
    }
  };

  // Metrics Calculation
  const activeContracts = ugovori.filter((c) => c.status === "aktivno");
  const totalMonthlyValue = activeContracts.reduce(
    (sum, c) => sum + (Number(c.osnovna_zakupnina) || 0),
    0,
  );
  const expiringSoonCount = activeContracts.filter((c) =>
    isExpiring(c.datum_zavrsetka),
  ).length;
  const indexationNeededCount = activeContracts.filter(
    (c) => c.indeksacija === true,
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      {/* Off-screen print template */}
      {/* Off-screen print template */}
      <div className="absolute top-0 left-[-9999px] -z-50">
        <ContractPrintTemplate
          ref={printRef}
          contracts={filteredUgovori.map((c) => ({
            ...c,
            zakupnik_naziv: c.zakupnik_naziv || "Nepoznat zakupnik", // Ensure name is present
          }))}
          nekretnine={nekretnine}
          zakupnici={zakupnici}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            Ugovori
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pregled i upravljanje ugovorima o zakupu, aneksima i rokovima.
          </p>
        </div>
        <div className="flex items-center gap-2 mr-2">
          <Switch
            id="archive-mode"
            checked={showArchive}
            onCheckedChange={setShowArchive}
          />
          <Label htmlFor="archive-mode" className="cursor-pointer">
            Arhiva
          </Label>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {filterProperty === "all"
                  ? "Sve nekretnine"
                  : nekretnine.find((n) => n.id === filterProperty)?.naziv ||
                    "Nekretnina"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtriraj po nekretnini</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterProperty("all")}>
                Sve nekretnine
              </DropdownMenuItem>
              {nekretnine.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => setFilterProperty(n.id)}
                >
                  {n.naziv}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Ispiši izvještaj
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novi ugovor
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ukupna mjesečna vrijednost
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMonthlyValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Samo aktivni ugovori
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ugovori na isteku (90 dana)
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoonCount}</div>
            <p className="text-xs text-muted-foreground">Zahtijevaju pažnju</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ugovori s indeksacijom
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indexationNeededCount}</div>
            <p className="text-xs text-muted-foreground">
              Ukupno ugovora s klauzulom
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broj ugovora</TableHead>
              <TableHead>Zakupnik</TableHead>
              <TableHead>Nekretnina</TableHead>
              <TableHead>Trajanje</TableHead>
              <TableHead className="text-right">Iznos</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Dokument</TableHead>
              <TableHead className="text-center">Primopredaja</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUgovori.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-96 text-center">
                  <EmptyState
                    icon={FileText}
                    title="Nema ugovora"
                    description={
                      showArchive
                        ? "Nema arhiviranih ugovora u sustavu."
                        : filterProperty !== "all"
                          ? "Nema aktivnih ugovora za odabranu nekretninu."
                          : "Trenutno nemate aktivnih ugovora."
                    }
                    actionLabel={
                      !showArchive && filterProperty === "all"
                        ? "Kreiraj novi ugovor"
                        : null
                    }
                    onAction={
                      !showArchive && filterProperty === "all"
                        ? handleCreate
                        : null
                    }
                    className="border-0 shadow-none animate-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredUgovori.map((ugovor) => {
                const expired = isExpired(ugovor.datum_zavrsetka);
                const expiring = isExpiring(ugovor.datum_zavrsetka);
                const property = nekretnine.find(
                  (n) => n.id === ugovor.nekretnina_id,
                );
                const propertyName = property?.naziv || "—";

                const unit = propertyUnits?.find(
                  (u) => u.id === ugovor.property_unit_id,
                );
                const unitName = unit ? getUnitDisplayName(unit) : null;

                let displayStatus = ugovor.status || "Nepoznato";
                if (ugovor.status === "aktivno" && expiring) {
                  displayStatus = "Na isteku";
                }

                const contractDoc = docsByContract[ugovor.id]?.contract;

                return (
                  <TableRow
                    key={ugovor.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setViewContract(ugovor);
                      setDetailsOpen(true);
                    }}
                  >
                    <TableCell className="font-mono font-medium">
                      {ugovor.interna_oznaka}
                    </TableCell>
                    <TableCell>
                      {ugovor.zakupnik_naziv || "Nepoznat zakupnik"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{propertyName}</span>
                        {unitName && (
                          <span className="text-xs text-muted-foreground">
                            {unitName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>{formatDate(ugovor.datum_pocetka)}</span>
                        <span
                          className={
                            expired ? "text-destructive font-medium" : ""
                          }
                        >
                          {formatDate(ugovor.datum_zavrsetka)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(ugovor.osnovna_zakupnina)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          displayStatus === "Na isteku"
                            ? "warning"
                            : ugovor.status === "aktivno"
                              ? "default"
                              : "secondary"
                        }
                        className={`capitalize ${displayStatus === "Na isteku" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                      >
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contractDoc && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(buildDocumentUrl(contractDoc), "_blank")
                          }
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {docsByContract[ugovor.id]?.protocol && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(
                              buildDocumentUrl(
                                docsByContract[ugovor.id].protocol,
                              ),
                              "_blank",
                            )
                          }
                        >
                          <FileSignature className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(ugovor)}>
                            <FileText className="mr-2 h-4 w-4" /> Uredi
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>
                            Promijeni status
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(ugovor, "aktivno")
                            }
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> Aktivno
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(ugovor, "na_isteku")
                            }
                          >
                            <Clock className="mr-2 h-4 w-4" /> Na isteku
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(ugovor, "arhivirano")
                            }
                          >
                            <Archive className="mr-2 h-4 w-4" /> Arhivirano
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredUgovori.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nema ugovora"
            description={
              showArchive
                ? "Nema arhiviranih ugovora."
                : filterProperty !== "all"
                  ? "Nema aktivnih ugovora za odabranu nekretninu."
                  : "Trenutno nemate aktivnih ugovora."
            }
            actionLabel={
              !showArchive && filterProperty === "all" ? "Novi ugovor" : null
            }
            onAction={
              !showArchive && filterProperty === "all" ? handleCreate : null
            }
          />
        ) : (
          filteredUgovori.map((ugovor) => {
            const expired = isExpired(ugovor.datum_zavrsetka);
            const expiring = isExpiring(ugovor.datum_zavrsetka);
            const propertyName =
              nekretnine.find((n) => n.id === ugovor.nekretnina_id)?.naziv ||
              "—";

            let displayStatus = ugovor.status || "Nepoznato";
            if (ugovor.status === "aktivno" && expiring) {
              displayStatus = "Na isteku";
            }

            return (
              <Card
                key={ugovor.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setViewContract(ugovor);
                  setDetailsOpen(true);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-mono">
                        {ugovor.interna_oznaka}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ugovor.zakupnik_naziv || "Nepoznat zakupnik"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        displayStatus === "Na isteku"
                          ? "warning"
                          : ugovor.status === "aktivno"
                            ? "default"
                            : "secondary"
                      }
                      className={`capitalize ${displayStatus === "Na isteku" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                    >
                      {displayStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Nekretnina
                      </span>
                      <span className="font-medium truncate block">
                        {propertyName}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Iznos
                      </span>
                      <span className="font-medium">
                        {formatCurrency(ugovor.osnovna_zakupnina)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      {formatDate(ugovor.datum_pocetka)} -{" "}
                      <span
                        className={
                          expired ? "text-destructive font-medium" : ""
                        }
                      >
                        {formatDate(ugovor.datum_zavrsetka)}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8">
                      Detalji <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUgovor ? "Uredi ugovor" : "Novi ugovor"}
            </DialogTitle>
            <DialogDescription>
              {selectedUgovor
                ? "Izmijenite detalje postojećeg ugovora."
                : "Unesite podatke za novi ugovor o zakupu."}
            </DialogDescription>
          </DialogHeader>
          <UgovorForm
            ugovor={selectedUgovor}
            onSuccess={handleSuccess}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full max-w-full sm:w-[600px] overflow-y-auto p-0 flex flex-col h-full">
          {viewContract && (
            <>
              <div
                className={`h-2 w-full ${viewContract.status === "aktivno" ? "bg-emerald-500" : viewContract.status === "na_isteku" ? "bg-amber-500" : "bg-slate-300"}`}
              />
              <SheetHeader className="px-6 pt-6 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    {/* Context Header: Property - Unit */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Building className="h-3 w-3" />
                      <span className="font-medium uppercase tracking-wider">
                        {nekretnine.find(
                          (n) => n.id === viewContract.nekretnina_id,
                        )?.naziv || "Nepoznata nekretnina"}
                      </span>
                      {viewContract.property_unit_id && (
                        <>
                          <span className="text-muted-foreground/50 mx-1">
                            /
                          </span>
                          <span className="font-bold text-primary">
                            {getUnitDisplayName(
                              propertyUnits.find(
                                (u) =>
                                  u.id === viewContract.property_unit_id ||
                                  u.localId === viewContract.property_unit_id,
                              ),
                            ) || "Jedinica"}
                          </span>
                        </>
                      )}
                    </div>
                    <SheetTitle className="text-2xl font-bold text-foreground break-all">
                      {viewContract.interna_oznaka}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {viewContract.zakupnik_naziv || "Nepoznat zakupnik"}
                    </SheetDescription>
                  </div>
                  <Badge
                    variant={
                      viewContract.status === "aktivno"
                        ? "default"
                        : "secondary"
                    }
                    className="text-sm px-3 py-1 capitalize"
                  >
                    {viewContract.status?.replace("_", " ")}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs defaultValue="pregled" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="pregled">Pregled</TabsTrigger>
                    <TabsTrigger value="financije">Financije</TabsTrigger>
                    <TabsTrigger value="dokumenti">Dokumenti</TabsTrigger>
                  </TabsList>

                  <TabsContent value="pregled" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Nekretnina
                        </Label>
                        <div className="font-medium flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {nekretnine.find(
                            (n) => n.id === viewContract.nekretnina_id,
                          )?.naziv || "—"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Zakupnik
                        </Label>
                        <div className="font-medium flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {viewContract.zakupnik_naziv || "—"}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Trajanje i rokovi
                      </h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Početak
                          </span>
                          <span className="font-medium">
                            {formatDate(viewContract.datum_pocetka)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Završetak
                          </span>
                          <span className="font-medium">
                            {formatDate(viewContract.datum_zavrsetka)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Trajanje
                          </span>
                          <span className="font-medium">
                            {viewContract.trajanje_mjeseci} mj.
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Rok otkaza
                          </span>
                          <span className="font-medium">
                            {viewContract.rok_otkaza_dani} dana
                          </span>
                        </div>
                      </div>
                    </div>

                    {viewContract.napomena && (
                      <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                        <span className="font-semibold block mb-1">
                          Napomena
                        </span>
                        <p className="text-muted-foreground">
                          {viewContract.napomena}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="financije" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-primary mb-1">
                            {formatCurrency(viewContract.osnovna_zakupnina)}
                          </div>
                          <p className="text-xs text-muted-foreground uppercase">
                            Mjesečna zakupnina
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold mb-1">
                            {formatCurrency(viewContract.polog_depozit)}
                          </div>
                          <p className="text-xs text-muted-foreground uppercase">
                            Depozit
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Detalji plaćanja
                      </h4>
                      <div className="rounded-lg border divide-y">
                        <div className="flex justify-between p-3 text-sm">
                          <span className="text-muted-foreground">
                            Cijena po m²
                          </span>
                          <span className="font-medium">
                            {viewContract.zakupnina_po_m2
                              ? formatCurrency(viewContract.zakupnina_po_m2)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between p-3 text-sm">
                          <span className="text-muted-foreground">
                            CAM troškovi
                          </span>
                          <span className="font-medium">
                            {viewContract.cam_troskovi
                              ? formatCurrency(viewContract.cam_troskovi)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between p-3 text-sm">
                          <span className="text-muted-foreground">
                            Garancija
                          </span>
                          <span className="font-medium">
                            {viewContract.garancija
                              ? formatCurrency(viewContract.garancija)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {viewContract.indeksacija && (
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Indeksacija
                        </h4>
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Indeks
                            </span>
                            <span className="font-medium">
                              {viewContract.indeks || "Nije definiran"}
                            </span>
                          </div>
                          {viewContract.formula_indeksacije && (
                            <div className="pt-2 border-t border-blue-200/50">
                              <span className="text-xs text-muted-foreground block mb-1">
                                Formula
                              </span>
                              <code className="bg-white px-2 py-1 rounded border text-xs block w-full">
                                {viewContract.formula_indeksacije}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="dokumenti" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Priloženi dokumenti
                        </h4>
                        <Badge variant="outline">{documents.length}</Badge>
                      </div>

                      <ScrollArea className="h-[400px] pr-4">
                        {documents.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/30">
                            <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Nema priloženih dokumenata
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all"
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="flex-shrink-0 rounded-md bg-primary/10 p-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {doc.naziv}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(doc.created_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      window.open(
                                        buildDocumentUrl(doc),
                                        "_blank",
                                      )
                                    }
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      const win = window.open(
                                        buildDocumentUrl(doc),
                                        "_blank",
                                      );
                                      if (win) win.onload = () => win.print();
                                    }}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="p-6 border-t bg-muted/10 mt-auto">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setDetailsOpen(false)}
                  >
                    Zatvori
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailsOpen(false);
                      handleEdit(viewContract);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Uredi ugovor
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default UgovoriPage;
