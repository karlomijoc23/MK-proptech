import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "../../components/ui/sonner";
import { Download, Eye, Printer, Search, Plus } from "lucide-react";
import { api, buildDocumentUrl } from "../../shared/api";
import {
  DOCUMENT_TYPE_LABELS,
  PROPERTY_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPES,
  resolveDocumentType,
  formatDocumentType,
} from "../../shared/documents";
import { useEntityStore } from "../../shared/entityStore";
import {
  UNIT_STATUS_CONFIG,
  getUnitDisplayName,
  sortUnitsByPosition,
  resolveUnitTenantName,
} from "../../shared/units";
import DocumentViewer from "./components/DocumentViewer";

import DocumentWizard from "./DocumentWizard";

// Dokumenti Component
const DocumentsPage = () => {
  const {
    dokumenti,
    nekretnine,
    zakupnici,
    ugovori,
    propertyUnitsByProperty,
    propertyUnitsById,
    loading: storeLoading,
    refresh,
    syncDocument,
  } = useEntityStore();
  const [isMutating, setIsMutating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("svi");
  const [searchQuery, setSearchQuery] = useState("");
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

  const getLinkedEntity = useCallback(
    (dokument) => {
      if (dokument.property_unit_id) {
        const unit = propertyUnitsById?.[dokument.property_unit_id];
        if (unit) {
          const property = nekretnine.find((n) => n.id === unit.nekretnina_id);
          const tenant = zakupnici.find((z) => z.id === unit.zakupnik_id);
          const descriptor = [
            getUnitDisplayName(unit),
            property?.naziv,
            tenant ? tenant.naziv_firme || tenant.ime_prezime : null,
          ]
            .filter(Boolean)
            .join(" • ");
          return {
            tip: "Podprostor",
            naziv: descriptor || getUnitDisplayName(unit),
          };
        }
        return { tip: "Podprostor", naziv: "Povezana jedinica" };
      }
      if (dokument.nekretnina_id) {
        const nekretnina = nekretnine.find(
          (n) => n.id === dokument.nekretnina_id,
        );
        return {
          tip: "Nekretnina",
          naziv: nekretnina?.naziv || "Nepoznata nekretnina",
        };
      }
      if (dokument.zakupnik_id) {
        const zakupnik = zakupnici.find((z) => z.id === dokument.zakupnik_id);
        return {
          tip: "Zakupnik",
          naziv:
            zakupnik?.naziv_firme ||
            zakupnik?.ime_prezime ||
            "Nepoznat zakupnik",
        };
      }
      if (dokument.ugovor_id) {
        const ugovor = ugovori.find((u) => u.id === dokument.ugovor_id);
        return { tip: "Ugovor", naziv: ugovor?.interna_oznaka || "N/A" };
      }
      return { tip: "Općenito", naziv: "Nema povezanosti" };
    },
    [nekretnine, zakupnici, ugovori, propertyUnitsById],
  );

  const filteredDokumenti = useMemo(() => {
    return dokumenti.filter((dokument) => {
      if (filterCategory !== "svi" && dokument.tip !== filterCategory) {
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

  const getDocumentUrl = useCallback(
    (dokument) => buildDocumentUrl(dokument),
    [],
  );

  const handleCreateDokument = async (formData) => {
    setIsMutating(true);
    const toastId = toast.loading("Spremam dokument…");
    try {
      const response = await api.createDokument(formData);
      if (response?.data) {
        syncDocument(response.data);
      }
      toast.success("Dokument je uspješno dodan", { id: toastId });
      setShowCreateForm(false);
      try {
        await refresh();
      } catch (refreshError) {
        console.error("Greška pri osvježavanju dokumenata:", refreshError);
      }
    } catch (error) {
      console.error("Greška pri dodavanju dokumenta:", error);
      const message =
        error.response?.data?.detail || "Greška pri dodavanju dokumenta";
      toast.error(message, { id: toastId });
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
          <Button
            onClick={() => setShowCreateForm(true)}
            data-testid="dodaj-dokument-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj dokument
          </Button>
        </div>
      </div>

      <div className="flex space-x-2 flex-wrap">
        <Button
          variant={filterCategory === "svi" ? "default" : "outline"}
          onClick={() => setFilterCategory("svi")}
          size="sm"
        >
          Svi ({dokumenti.length})
        </Button>
        <Button
          variant={filterCategory === "ugovor" ? "default" : "outline"}
          onClick={() => setFilterCategory("ugovor")}
          size="sm"
        >
          Ugovori ({categoryCounts.ugovor || 0})
        </Button>
        <Button
          variant={
            filterCategory === "zemljisnoknjizni_izvadak"
              ? "default"
              : "outline"
          }
          onClick={() => setFilterCategory("zemljisnoknjizni_izvadak")}
          size="sm"
        >
          Z.K. izvadci ({categoryCounts.zemljisnoknjizni_izvadak || 0})
        </Button>
        <Button
          variant={filterCategory === "osiguranje" ? "default" : "outline"}
          onClick={() => setFilterCategory("osiguranje")}
          size="sm"
        >
          Osiguranja ({categoryCounts.osiguranje || 0})
        </Button>
        <Button
          variant={filterCategory === "certifikat" ? "default" : "outline"}
          onClick={() => setFilterCategory("certifikat")}
          size="sm"
        >
          Certifikati ({categoryCounts.certifikat || 0})
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDokumenti.map((dokument) => {
          const linkedEntity = getLinkedEntity(dokument);
          return (
            <Card
              key={dokument.id}
              data-testid={`dokument-card-${dokument.id}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{dokument.naziv}</span>
                  <Badge variant="outline">
                    {formatDocumentType(dokument.tip)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Vezano za:</span>{" "}
                  {linkedEntity.tip}
                </p>
                <p
                  className="text-sm text-blue-600 truncate"
                  title={linkedEntity.naziv}
                >
                  {linkedEntity.naziv}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Datum:</span>{" "}
                  {new Date(dokument.kreiran).toLocaleDateString()}
                </p>
                {dokument.opis && (
                  <p className="text-sm text-muted-foreground">
                    {dokument.opis}
                  </p>
                )}
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
                        toast.error(
                          "PDF datoteka nije učitana za ovaj dokument",
                        );
                        return;
                      }
                      window.open(url, "_blank", "noopener");
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
          <DocumentWizard
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
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="document-preview-description"
        >
          <DialogHeader>
            <DialogTitle>
              Pregled dokumenta: {previewDocument?.naziv}
            </DialogTitle>
          </DialogHeader>
          <div id="document-preview-description" className="sr-only">
            Pregled dokumenta u aplikaciji
          </div>

          {previewDocument && (
            <div className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Naziv:</span>{" "}
                    {previewDocument.naziv}
                  </div>
                  <div>
                    <span className="font-medium">Tip:</span>{" "}
                    {formatDocumentType(previewDocument.tip)}
                  </div>
                  <div>
                    <span className="font-medium">Datum:</span>{" "}
                    {new Date(previewDocument.kreiran).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Vezano za:</span>{" "}
                    {getLinkedEntity(previewDocument).tip}
                  </div>
                </div>
                {previewDocument.opis && (
                  <div className="mt-3">
                    <span className="font-medium">Opis:</span>
                    <p className="mt-1 text-muted-foreground">
                      {previewDocument.opis}
                    </p>
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
                          toast.error(
                            "PDF datoteka nije učitana za ovaj dokument",
                          );
                          return;
                        }
                        window.open(url, "_blank", "noopener");
                      }}
                      disabled={!previewDocument.putanja_datoteke}
                      data-testid="download-document"
                    >
                      <Download className="w-4 h-4 mr-2" /> Otvori u novom
                      prozoru
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
                          toast.error(
                            "PDF datoteka nije učitana za ovaj dokument",
                          );
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
                  Datoteka:{" "}
                  {previewDocument.putanja_datoteke || "Nije prenesena"}
                  {previewDocument.velicina_datoteke > 0 && (
                    <>
                      {" "}
                      • Veličina:{" "}
                      {(previewDocument.velicina_datoteke / 1024).toFixed(1)} KB
                    </>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewDialog(false)}
                  className="flex-1"
                >
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

export default DocumentsPage;
export { DocumentsPage };
