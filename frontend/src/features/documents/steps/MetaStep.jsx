import React, { useMemo } from "react";
import { Label } from "../../../components/ui/label";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { useDocumentWizard } from "../DocumentWizard";

const MetaStep = () => {
  const {
    formData,
    setFormData,
    aiSuggestions,
    aiLoading,
    aiError,
    aiApplied,
    DOCUMENT_TYPE_LABELS,
    PROPERTY_DOCUMENT_TYPES,
    CONTRACT_DOCUMENT_TYPES,
    formatDocumentType,
  } = useDocumentWizard();

  const documentOptions = useMemo(
    () =>
      Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [DOCUMENT_TYPE_LABELS],
  );

  const selectedDocTypeLabel = formatDocumentType(formData.tip);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="naziv">Naziv dokumenta *</Label>
          <Input
            id="naziv"
            value={formData.naziv}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, naziv: event.target.value }))
            }
            data-testid="dokument-naziv-input"
            placeholder="npr. Ugovor o zakupu"
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
                  next.zakupnik_id = "";
                  next.ugovor_id = "";
                }
                if (PROPERTY_DOCUMENT_TYPES.has(value)) {
                  next.property_unit_id = "";
                }
                return next;
              })
            }
          >
            <SelectTrigger data-testid="dokument-tip-select">
              <SelectValue placeholder="Odaberite tip" />
            </SelectTrigger>
            <SelectContent>
              {documentOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-1 text-xs text-muted-foreground/80">
            Aktivni tip: <Badge variant="outline">{selectedDocTypeLabel}</Badge>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="opis">Opis dokumenta</Label>
        <Textarea
          id="opis"
          value={formData.opis}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, opis: event.target.value }))
          }
          data-testid="dokument-opis-input"
          rows={4}
          placeholder="Sažetak sadržaja dokumenta ili posebne napomene"
        />
      </div>

      {aiSuggestions && (
        <div className="rounded-md border border-border/60 bg-white/70 p-4 text-xs text-muted-foreground">
          <p>
            AI predloženi tip dokumenta:{" "}
            <strong>{formatDocumentType(aiSuggestions.document_type)}</strong>
            {aiApplied ? " (primijenjeno)" : " (isključeno)"}
          </p>
          {PROPERTY_DOCUMENT_TYPES.has(formData.tip) && (
            <p className="mt-2 text-amber-600">
              Ovo je dokument povezan s nekretninom. Polja za zakupnika i ugovor
              nisu dostupna.
            </p>
          )}
          {CONTRACT_DOCUMENT_TYPES.has(formData.tip) && (
            <p className="mt-2 text-emerald-600">
              Dokument je povezan s ugovorima. Preporučujemo povezivanje s
              postojećim ugovorom.
            </p>
          )}
        </div>
      )}

      {(aiLoading || aiError) && (
        <div className="rounded-md border border-border/60 bg-white p-3 text-xs text-muted-foreground">
          {aiLoading && (
            <p>Analiziram podatke kako bi popunio osnovne informacije…</p>
          )}
          {aiError && <p className="text-destructive">{aiError}</p>}
        </div>
      )}
    </div>
  );
};

export default MetaStep;
