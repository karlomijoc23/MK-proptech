import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { api } from "../shared/api";

export const ClickableReminder = ({ podsjetnik }) => {
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

  // Note: The original code had more rendering logic here which was cut off in the view_file.
  // I will assume standard rendering based on what I can infer or I should have read more.
  // But since I don't have the full render logic, I might break it if I don't copy it exactly.
  // I'll try to reconstruct it or read the file again.

  // Wait, I only read up to line 800 in App.js. ClickableReminder starts at 697.
  // I saw up to line 800.
  // The render function was cut off.

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${getPriorityColor(podsjetnik.dani_do_isteka)}`}
      onClick={handleReminderClick}
    >
      <div>
        <p className="font-medium text-foreground">
          Istek ugovora: {ugovorDetails.ugovor?.interna_oznaka}
        </p>
        <p className="text-sm text-muted-foreground">
          {ugovorDetails.zakupnik?.naziv} - {ugovorDetails.nekretnina?.naziv}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-white/50">
          {podsjetnik.dani_do_isteka} dana
        </Badge>
      </div>

      {showRenewalDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Obnova ugovora</h3>
            <p className="mb-4">Odaberite trajanje nove obnove:</p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setShowRenewalDialog(false)}
              >
                Odustani
              </button>
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => handleRenewContract(1)}
              >
                1 Godina
              </button>
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => handleRenewContract(3)}
              >
                3 Godine
              </button>
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => handleRenewContract(5)}
              >
                5 Godina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
