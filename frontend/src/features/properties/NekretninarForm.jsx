import React, { useState, useMemo } from "react";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import {
  UNIT_STATUS_CONFIG,
  sortUnitsByPosition,
  getUnitDisplayName,
  getUnitStatusBadgeClass,
  formatUnitStatus,
} from "../../shared/units";
import { parseNumericValue } from "../../shared/formatters";

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

export default NekretninarForm;
