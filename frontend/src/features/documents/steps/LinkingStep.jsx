import React from "react";
import { Button } from "../../../components/ui/button";
import LinkedEntitySelect from "../../../components/LinkedEntitySelect";
import { useDocumentWizard } from "../DocumentWizard";

const LinkingStep = () => {
  const {
    formData,
    setFormData,
    nekretnine,
    zakupnici,
    ugovori,
    contractsForProperty,
    unitsForSelectedProperty,
    matchedProperty,
    matchedTenant,
    matchedContract,
    matchedPropertyUnit,
    showManualUnitForm,
    setShowManualUnitForm,
    manualUnitErrors,
    setManualUnitErrors,
    resetManualUnitForm,
    aiSuggestions,
    handleCreateContractFromAI,
    quickCreateLoading,
  } = useDocumentWizard();

  const selectedProperty = formData.nekretnina_id
    ? nekretnine.find((property) => property.id === formData.nekretnina_id)
    : null;

  const tenantOptions = zakupnici.filter(
    (tenant) => (tenant.status || "aktivan") !== "arhiviran",
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <LinkedEntitySelect
            label="Nekretnina"
            placeholder="Odaberite nekretninu"
            value={formData.nekretnina_id}
            onChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                nekretnina_id: value,
                property_unit_id: value ? prev.property_unit_id : "",
                ugovor_id: value ? prev.ugovor_id : "",
              }));
              if (manualUnitErrors.property) {
                setManualUnitErrors((prev) => {
                  const next = { ...prev };
                  delete next.property;
                  return next;
                });
              }
            }}
            entities={nekretnine}
            renderLabel={(property) => `${property.naziv} – ${property.adresa}`}
          />
          {selectedProperty && (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedProperty.adresa || "Adresa nije dostupna"}
            </p>
          )}
          {matchedProperty && !formData.nekretnina_id && (
            <p className="mt-2 text-xs text-emerald-600">
              Pronađena podudarnost: {matchedProperty.naziv}
            </p>
          )}
        </div>
        <div>
          <LinkedEntitySelect
            label="Podprostor"
            placeholder={
              formData.nekretnina_id
                ? "Odaberite podprostor"
                : "Najprije odaberite nekretninu"
            }
            disabled={!formData.nekretnina_id}
            value={formData.property_unit_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, property_unit_id: value }))
            }
            entities={unitsForSelectedProperty}
            renderLabel={(unit) =>
              `${unit.oznaka || unit.naziv} (${unit.status})`
            }
          />
          {matchedPropertyUnit && !formData.property_unit_id && (
            <p className="mt-2 text-xs text-emerald-600">
              AI prijedlog:{" "}
              {matchedPropertyUnit.oznaka || matchedPropertyUnit.naziv}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setShowManualUnitForm((prev) => {
                  const next = !prev;
                  if (!prev && next) {
                    resetManualUnitForm();
                  }
                  return next;
                })
              }
            >
              {showManualUnitForm
                ? "Sakrij ručni unos"
                : "Dodaj novi podprostor"}
            </Button>
            {manualUnitErrors.property && (
              <span className="text-xs text-destructive">
                {manualUnitErrors.property}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <LinkedEntitySelect
            label="Zakupnik"
            placeholder="Odaberite zakupnika"
            value={formData.zakupnik_id}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                zakupnik_id: value,
                ugovor_id: value ? prev.ugovor_id : "",
              }))
            }
            entities={tenantOptions}
            renderLabel={(tenant) =>
              `${tenant.naziv_firme || tenant.ime_prezime} – ${tenant.oib}`
            }
            disabled={!formData.tip || formData.tip === "procjena_vrijednosti"}
          />
          {matchedTenant && !formData.zakupnik_id && (
            <p className="mt-2 text-xs text-emerald-600">
              Prepoznat zakupnik:{" "}
              {matchedTenant.naziv_firme || matchedTenant.ime_prezime}
            </p>
          )}
        </div>
        <div>
          <LinkedEntitySelect
            label="Ugovor"
            placeholder="Odaberite ugovor"
            value={formData.ugovor_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, ugovor_id: value }))
            }
            entities={contractsForProperty}
            renderLabel={(contract) => contract.interna_oznaka}
            disabled={!formData.nekretnina_id}
          />
          {matchedContract && !formData.ugovor_id && (
            <p className="mt-2 text-xs text-emerald-600">
              Prepoznat ugovor: {matchedContract.interna_oznaka}
            </p>
          )}
          {!formData.ugovor_id && aiSuggestions?.ugovor && (
            <div className="mt-3 space-y-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateContractFromAI}
                disabled={
                  quickCreateLoading.contract ||
                  !formData.nekretnina_id ||
                  !formData.zakupnik_id ||
                  !formData.property_unit_id
                }
              >
                {quickCreateLoading.contract
                  ? "Spremam..."
                  : "Kreiraj ugovor iz AI prijedloga"}
              </Button>
              {(!formData.nekretnina_id || !formData.zakupnik_id) && (
                <p className="text-xs text-amber-600">
                  Povežite nekretninu i zakupnika kako biste kreirali ugovor.
                </p>
              )}
              {formData.nekretnina_id &&
                formData.zakupnik_id &&
                !formData.property_unit_id && (
                  <p className="text-xs text-amber-600">
                    Odaberite ili dodajte podprostor prije kreiranja ugovora.
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkingStep;
