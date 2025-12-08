import React, { useState, useMemo, useRef } from "react";
import { useEntityStore } from "../../shared/entityStore";
import { api } from "../../shared/api";
import { toast } from "../../components/ui/sonner";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Plus,
  Users,
  Mail,
  Phone,
  MapPin,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Printer,
  ArrowRight,
} from "lucide-react";
import ZakupnikForm from "./ZakupnikForm";
import ZakupnikDetails from "./ZakupnikDetails";
import { useReactToPrint } from "react-to-print";

const ZakupniciPage = () => {
  const { zakupnici, refresh: refreshZakupnici, loading } = useEntityStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedZakupnik, setSelectedZakupnik] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("active"); // "active" or "archived"

  const printRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedZakupnik
      ? `Zakupnik_${selectedZakupnik.naziv_firme || selectedZakupnik.ime_prezime}`
      : "Zakupnik",
  });

  const handleCreate = () => {
    setSelectedZakupnik(null);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (zakupnik) => {
    setSelectedZakupnik(zakupnik);
    setIsEditing(false); // Open in view mode
    setIsDialogOpen(true);
  };

  const handleDelete = async (zakupnik, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Jeste li sigurni da želite obrisati zakupnika "${zakupnik.naziv_firme || zakupnik.ime_prezime}"?`,
      )
    ) {
      return;
    }
    toast.error("Brisanje zakupnika nije trenutno podržano.");
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (selectedZakupnik) {
        await api.updateZakupnik(selectedZakupnik.id, data);
        toast.success("Zakupnik je ažuriran");
      } else {
        await api.createZakupnik(data);
        toast.success("Zakupnik je kreiran");
      }
      setIsDialogOpen(false);
      await refreshZakupnici();
    } catch (error) {
      console.error("Greška pri spremanju zakupnika:", error);
      toast.error("Spremanje nije uspjelo");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTenants = useMemo(() => {
    return zakupnici.filter((tenant) => {
      const name = tenant.naziv_firme || tenant.ime_prezime || "";
      const oib = tenant.oib || "";
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        oib.includes(searchQuery);

      const isActive = !tenant.status || tenant.status === "aktivan";
      const matchesStatus = viewMode === "active" ? isActive : !isActive;

      return matchesSearch && matchesStatus;
    });
  }, [zakupnici, searchQuery, viewMode]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Zakupnici
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upravljajte bazom zakupnika i partnera, kontakt podacima i
            ugovorima.
          </p>
        </div>
        <Button onClick={handleCreate} size="lg" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Dodaj zakupnika
        </Button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-muted/30 p-4 rounded-lg border border-border/50">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po imenu, tvrtki ili OIB-u..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="archive-mode"
              checked={viewMode === "archived"}
              onCheckedChange={(checked) =>
                setViewMode(checked ? "archived" : "active")
              }
            />
            <Label htmlFor="archive-mode" className="cursor-pointer">
              Arhiva
            </Label>
          </div>
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          Prikazano {filteredTenants.length} zapisa
        </div>
      </div>

      {/* Table Content */}
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Naziv / Ime</TableHead>
              <TableHead>OIB</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {loading ? (
                    <span className="text-muted-foreground">Učitavanje...</span>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Users className="h-8 w-8 mb-2 opacity-20" />
                      <p>Nema rezultata za zadane kriterije.</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((tenant) => {
                const isActive = !tenant.status || tenant.status === "aktivan";
                return (
                  <TableRow
                    key={tenant.id}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(tenant)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isActive ? "bg-green-500" : "bg-red-500"
                          }`}
                          title={isActive ? "Aktivan" : "Neaktivan/Arhiviran"}
                        />
                        <div className="flex flex-col">
                          <span className="text-foreground">
                            {tenant.naziv_firme || tenant.ime_prezime}
                          </span>
                          {(tenant.adresa_grad || tenant.sjediste) && (
                            <span className="text-xs text-muted-foreground flex items-center mt-0.5">
                              <MapPin className="h-3 w-3 mr-1" />
                              {tenant.adresa_grad || tenant.sjediste}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tenant.oib || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {tenant.kontakt_email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span
                              className="truncate max-w-[150px]"
                              title={tenant.kontakt_email}
                            >
                              {tenant.kontakt_email}
                            </span>
                          </div>
                        )}
                        {tenant.kontakt_telefon && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">
                              {tenant.kontakt_telefon}
                            </span>
                          </div>
                        )}
                        {!tenant.kontakt_email && !tenant.kontakt_telefon && (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(tenant);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" /> Uredi
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleDelete(tenant, e)}
                            className="text-muted-foreground cursor-not-allowed opacity-50"
                            disabled
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Obriši
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
        {filteredTenants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/10">
            {loading ? "Učitavanje..." : "Nema rezultata za zadane kriterije."}
          </div>
        ) : (
          filteredTenants.map((tenant) => {
            const isActive = !tenant.status || tenant.status === "aktivan";
            return (
              <Card
                key={tenant.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleEdit(tenant)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"}`}
                        title={isActive ? "Aktivan" : "Neaktivan/Arhiviran"}
                      />
                      <div>
                        <CardTitle className="text-base">
                          {tenant.naziv_firme || tenant.ime_prezime}
                        </CardTitle>
                        {(tenant.adresa_grad || tenant.sjediste) && (
                          <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            {tenant.adresa_grad || tenant.sjediste}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">OIB</span>
                      <span className="font-mono">{tenant.oib || "—"}</span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {tenant.kontakt_email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">
                            {tenant.kontakt_email}
                          </span>
                        </div>
                      )}
                      {tenant.kontakt_telefon && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{tenant.kontakt_telefon}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-2">
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
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <div>
              <DialogTitle>
                {selectedZakupnik ? "Detalji zakupnika" : "Novi zakupnik"}
              </DialogTitle>
              <DialogDescription>
                {selectedZakupnik
                  ? "Pregled i izmjena podataka o zakupniku."
                  : "Unesite podatke za novog zakupnika."}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div ref={printRef} className="p-1">
            {isEditing ? (
              <ZakupnikForm
                zakupnik={selectedZakupnik}
                onSubmit={handleSubmit}
                onCancel={() => {
                  if (selectedZakupnik) {
                    setIsEditing(false);
                  } else {
                    setIsDialogOpen(false);
                  }
                }}
                submitting={submitting}
              />
            ) : (
              <ZakupnikDetails
                zakupnik={selectedZakupnik}
                onEdit={() => setIsEditing(true)}
                onPrint={handlePrint}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZakupniciPage;
