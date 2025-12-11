import React, { useState, useMemo } from "react";
import { useEntityStore } from "../../shared/entityStore";
import { api } from "../../shared/api";
import { toast } from "../../components/ui/sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  Plus,
  Building,
  MapPin,
  Ruler,
  Euro,
  Search,
  Filter,
  LayoutGrid,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Printer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import NekretninarForm from "./NekretninarForm";
import NekretninaDetails from "./NekretninaDetails";
import { formatCurrency, formatArea } from "../../shared/formatters";

import { generatePdf } from "../../shared/pdfGenerator";
import PropertyPrintTemplate from "./PropertyPrintTemplate";
import { EmptyState } from "../../components/ui/empty-state";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

const NekretninePage = () => {
  const {
    nekretnine,
    ugovori,
    refresh: refreshNekretnine,
    loading,
    propertyUnits,
  } = useEntityStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [existingUnits, setExistingUnits] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);

  const confirmDelete = async () => {
    if (!propertyToDelete) return;
    try {
      await api.deleteNekretnina(propertyToDelete.id);
      toast.success("Nekretnina je obrisana");
      await refreshNekretnine();
    } catch (error) {
      console.error("Greška pri brisanju:", error);
      toast.error("Brisanje nije uspjelo");
    } finally {
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
    }
  };

  const handleDeleteCallback = (property) => {
    setPropertyToDelete(property);
    setDeleteDialogOpen(true);
  };

  // Quick View State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewProperty, setViewProperty] = useState(null);
  const [viewContracts, setViewContracts] = useState([]);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  /* Helper to calculate monthly income from active contracts */
  const calculateMonthlyIncome = (propertyId, allContracts) => {
    const activeContracts = allContracts.filter(
      (c) =>
        c.nekretnina_id === propertyId &&
        (c.status === "aktivno" || c.status === "na_isteku"),
    );
    return activeContracts.reduce(
      (sum, c) => sum + (parseFloat(c.osnovna_zakupnina) || 0),
      0,
    );
  };

  const printRef = React.useRef();

  const calculateOccupancy = (propertyId, allUnits) => {
    const units = allUnits.filter(
      (u) => u.nekretnina_id === propertyId || u.localId === propertyId,
    ); // Check both for robust matching
    if (units.length === 0) return { percent: 0, occupied: 0, total: 0 };

    // Total area of ALL units (this might be different from property.povrsina if we only count defined units)
    // Actually, usually users want to see occupied vs TOTAL property area.
    // BUT property.povrsina is just a number. Units area sum might not equal property.povrsina.
    // Let's stick to Units Sum as a base for "Rentable Area". OR use property.povrsina if units sum is 0?
    // User requested "percentage of rented space".
    // Strategy:
    // Total = Sum of all units area.
    // Occupied = Sum of rented units area.

    const totalArea = units.reduce(
      (sum, u) => sum + (parseFloat(u.povrsina_m2) || 0),
      0,
    );
    const occupiedArea = units
      .filter((u) => u.status === "iznajmljeno")
      .reduce((sum, u) => sum + (parseFloat(u.povrsina_m2) || 0), 0);

    if (totalArea === 0) return { percent: 0, occupied: 0, total: 0 };

    return {
      percent: Math.round((occupiedArea / totalArea) * 100),
      occupied: occupiedArea,
      total: totalArea,
    };
  };

  const handleCreate = () => {
    setSelectedProperty(null);
    setExistingUnits([]);
    setIsDialogOpen(true);
  };

  const handleEdit = async (property) => {
    setSelectedProperty(property);
    setExistingUnits([]); // Reset while loading
    try {
      const res = await api.getUnitsForProperty(property.id);
      setExistingUnits(res.data || []);
    } catch (err) {
      console.error("Failed to fetch units for editing", err);
      toast.error("Neuspješno učitavanje podprostora");
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (property) => {
    setPropertyToDelete(property);
    setDeleteDialogOpen(true);
  };

  const handleView = (property) => {
    setViewProperty(property);
    setViewContracts([]); // Reset
    setIsSheetOpen(true);
  };

  const handlePrint = async () => {
    if (!viewProperty) return;
    try {
      // Use contracts from store which are already enriching with tenant names
      const propertyContracts = ugovori.filter(
        (c) => c.nekretnina_id === viewProperty.id,
      );
      setViewContracts(propertyContracts);

      // Allow state to update before printing
      setTimeout(async () => {
        await generatePdf(
          printRef.current,
          `nekretnina_${viewProperty.naziv.replace(/\s+/g, "_")}`,
          "portrait",
        );
        toast.success("PDF je generiran");
      }, 100);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Greška pri generiranju PDF-a");
    }
  };

  const handleSubmit = async ({
    nekretnina,
    units,
    deletedUnitIds,
    imageFile,
  }) => {
    setSubmitting(true);
    try {
      let imagePath = nekretnina.slika;

      if (imageFile) {
        try {
          const docResponse = await api.createDokument({
            file: imageFile,
            tip: "ostalo", // Or "slika_nekretnine" if supported, but "ostalo" is safe
            naziv: `Slika - ${nekretnina.naziv || "Nekretnina"}`,
            nekretnina_id: selectedProperty?.id, // Might be null for new property, handled below
          });
          // If it's a new property, we can't link it yet in createDokument if we don't have ID.
          // But we need the path to save in property.
          // Actually, createDokument returns the document object.
          // We can use the returned path.
          // If we want to link it to the property, we might need to update the document AFTER creating the property if it's new.
          // But for now, let's just use the path for the property 'slika' field.
          if (docResponse.data && docResponse.data.putanja_datoteke) {
            imagePath = docResponse.data.putanja_datoteke;
          }
        } catch (uploadError) {
          console.error("Failed to upload image", uploadError);
          toast.error(
            "Prijenos slike nije uspio, ali nastavljam sa spremanjem nekretnine.",
          );
        }
      }

      const propertyData = { ...nekretnina, slika: imagePath };

      if (selectedProperty) {
        await api.updateNekretnina(selectedProperty.id, propertyData);
        const propertyId = selectedProperty.id;

        // Handle Units (Create & Update)
        if (units && units.length > 0) {
          for (const unit of units) {
            if (unit.id) {
              await api.updateUnit(unit.id, unit);
            } else {
              await api.createUnit(propertyId, unit);
            }
          }
        }

        // Handle Unit Deletions
        if (deletedUnitIds && deletedUnitIds.length > 0) {
          for (const unitId of deletedUnitIds) {
            await api.deleteUnit(unitId);
          }
        }

        toast.success("Nekretnina je ažurirana");
      } else {
        const response = await api.createNekretnina(propertyData);
        const newPropertyId = response.data.id;

        if (units && units.length > 0) {
          for (const unit of units) {
            await api.createUnit(newPropertyId, unit);
          }
        }
        toast.success("Nekretnina je kreirana");
      }
      setIsDialogOpen(false);
      await refreshNekretnine();
    } catch (error) {
      console.error("Greška pri spremanju nekretnine:", error);
      toast.error("Spremanje nije uspjelo");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProperties = useMemo(() => {
    return nekretnine.filter((property) => {
      const matchesSearch =
        (property.naziv?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        ) ||
        (property.adresa?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        );

      const matchesType = typeFilter === "all" || property.vrsta === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [nekretnine, searchQuery, typeFilter]);

  const propertyTypes = useMemo(() => {
    const types = new Set(nekretnine.map((p) => p.vrsta).filter(Boolean));
    return Array.from(types);
  }, [nekretnine]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 space-y-8">
      {/* Off-screen print template */}
      <div className="absolute top-0 left-[-9999px] -z-50">
        <PropertyPrintTemplate
          ref={printRef}
          property={viewProperty}
          contracts={viewContracts}
          units={
            viewProperty
              ? propertyUnits.filter(
                  (u) =>
                    u.nekretnina_id === viewProperty.id ||
                    u.localId === viewProperty.id,
                )
              : []
          }
        />
      </div>

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Nekretnine
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upravljajte portfeljem nekretnina, pratite vrijednost i ključne
            informacije.
          </p>
        </div>
        <Button onClick={handleCreate} size="lg" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Dodaj nekretninu
        </Button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-muted/30 p-4 rounded-lg border border-border/50">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po nazivu ili adresi..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Tip nekretnine" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi tipovi</SelectItem>
              {propertyTypes.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          Prikazano {filteredProperties.length} od {nekretnine.length}{" "}
          nekretnina
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProperties.map((property) => (
          <Card
            key={property.id}
            className="group overflow-hidden transition-all hover:shadow-lg hover:border-primary/20 flex flex-col"
          >
            {/* Image / Header */}
            <div className="h-48 bg-muted relative flex items-center justify-center border-b overflow-hidden">
              {property.slika ? (
                <img
                  src={`${api.getBackendUrl()}/${property.slika}`}
                  alt={property.naziv}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = ""; // Fallback to placeholder if load fails
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex"; // Show placeholder
                  }}
                />
              ) : null}

              {/* Placeholder (shown if no image or error) */}
              <div
                className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 ${property.slika ? "hidden" : "flex"}`}
              >
                <Building className="h-12 w-12 text-muted-foreground/20" />
              </div>

              <Badge
                variant="secondary"
                className="absolute top-3 right-3 capitalize shadow-sm bg-background/80 backdrop-blur-sm z-10"
              >
                {property.vrsta?.replace(/_/g, " ") || "Nekretnina"}
              </Badge>
            </div>

            <CardHeader className="pb-2">
              <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
                {property.naziv}
              </CardTitle>
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <MapPin className="mr-1 h-3 w-3" />
                <span className="truncate">{property.adresa}</span>
              </div>
            </CardHeader>

            <CardContent className="pb-4 flex-1 flex flex-col justify-end gap-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Ruler className="h-4 w-4" />
                  <span>{formatArea(property.povrsina)}</span>
                </div>
                {(() => {
                  const income = calculateMonthlyIncome(property.id, ugovori);
                  if (income > 0) {
                    return (
                      <div className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        + {formatCurrency(income)}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Euro className="h-4 w-4" />
                <span>
                  {formatCurrency(
                    property.trzisna_vrijednost || property.nabavna_cijena,
                  )}
                </span>
              </div>
            </CardContent>

            <div className="px-6 pb-2">
              {/* Occupancy Bar */}
              {(() => {
                const occupancy = calculateOccupancy(
                  property.id,
                  propertyUnits,
                );
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Zakupljenost
                      </span>
                      <span className="font-medium">{occupancy.percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500 ease-in-out"
                        style={{ width: `${occupancy.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <CardFooter className="flex gap-2 mt-auto pt-4 border-t px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleView(property)}
              >
                <Eye className="mr-2 h-4 w-4" /> Brzi pregled
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleView(property)}>
                    <Eye className="mr-2 h-4 w-4" /> Pregled
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(property)}>
                    <Edit className="mr-2 h-4 w-4" /> Uredi
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteCallback(property)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Obriši
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}

        {filteredProperties.length === 0 && !loading && (
          <div className="col-span-full">
            {searchQuery || typeFilter !== "all" ? (
              <EmptyState
                icon={Search}
                title="Nema pronađenih nekretnina"
                description="Nismo pronašli nijednu nekretninu koja odgovara vašim kriterijima pretraživanja."
                actionLabel="Očisti filtere"
                onAction={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
              />
            ) : (
              <EmptyState
                icon={Building}
                title="Nema nekretnina"
                description="Vaš portfelj je trenutno prazan. Dodajte svoju prvu nekretninu."
                actionLabel="Dodaj nekretninu"
                onAction={handleCreate}
              />
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProperty ? "Uredi nekretninu" : "Nova nekretnina"}
            </DialogTitle>
            <DialogDescription>
              {selectedProperty
                ? "Izmijenite detalje postojeće nekretnine."
                : "Unesite podatke za novu nekretninu u portfelju."}
            </DialogDescription>
          </DialogHeader>
          <NekretninarForm
            nekretnina={selectedProperty}
            existingUnits={existingUnits}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* Quick View Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[800px] sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="flex flex-row justify-between items-start">
            <div>
              <SheetTitle>Detalji nekretnine</SheetTitle>
              <SheetDescription>
                Pregled svih informacija o nekretnini.
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="mr-8"
            >
              <Printer className="mr-2 h-4 w-4" /> Ispiši
            </Button>
          </SheetHeader>
          <div className="mt-6">
            <NekretninaDetails nekretnina={viewProperty} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jeste li sigurni?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova radnja se ne može poništiti. Ovo će trajno obrisati nekretninu
              "{propertyToDelete?.naziv}" i sve povezane podatke.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NekretninePage;
