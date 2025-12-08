import React, { forwardRef } from "react";
import {
  formatDate,
  formatCurrency,
  formatArea,
} from "../../shared/formatters";
import { api } from "../../shared/api";

const PropertyPrintTemplate = forwardRef(
  ({ property, contracts, units = [] }, ref) => {
    if (!property) return null;

    const getImageUrl = (path) => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      // Ensure no double slashes if path starts with /
      const baseUrl = api.getBackendUrl().replace(/\/$/, "");
      const cleanPath = path.startsWith("/") ? path.substring(1) : path;
      return `${baseUrl}/${cleanPath}`;
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black print:w-full print:h-auto w-[210mm] min-h-[297mm] mx-auto text-sm leading-relaxed"
      >
        <style type="text/css" media="print">
          {`
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-family: sans-serif;
                    }
                `}
        </style>
        <div className="p-8 print:p-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 border-b-2 border-gray-800 pb-4">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold uppercase">
                  {property.naziv}
                </h1>
                {property.vrsta && (
                  <span className="text-[10px] px-2 py-0.5 border border-black rounded-full uppercase tracking-wider">
                    {property.vrsta.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="text-gray-600 font-medium">{property.adresa}</p>
            </div>
            {property.slika && (
              <div className="w-40 h-28 overflow-hidden rounded border border-gray-200 shadow-sm shrink-0">
                <img
                  src={getImageUrl(property.slika)}
                  alt={property.naziv}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.style.display = "none")}
                />
              </div>
            )}
          </div>

          {/* Key Metrics Grid - Compact */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Površina
              </p>
              <p className="text-lg font-bold">
                {formatArea(property.povrsina)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Vrijednost
              </p>
              <p className="text-lg font-bold">
                {formatCurrency(
                  property.trzisna_vrijednost || property.nabavna_cijena,
                )}
              </p>
            </div>

            {/* Monthly Income Metric */}
            {(() => {
              const activeContracts = contracts.filter(
                (c) => c.status === "aktivno" || c.status === "na_isteku",
              );
              const income = activeContracts.reduce(
                (sum, c) => sum + (parseFloat(c.osnovna_zakupnina) || 0),
                0,
              );

              return (
                <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Mjesečni Prihod
                  </p>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrency(income)}
                  </p>
                </div>
              );
            })()}

            {/* Occupancy Metric */}
            {(() => {
              if (!units || units.length === 0)
                return (
                  <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                      Zakupljenost
                    </p>
                    <p className="text-lg font-bold text-gray-400">—</p>
                  </div>
                );

              const totalArea = units.reduce(
                (sum, u) => sum + (parseFloat(u.povrsina_m2) || 0),
                0,
              );
              const occupiedArea = units
                .filter((u) => u.status === "iznajmljeno")
                .reduce((sum, u) => sum + (parseFloat(u.povrsina_m2) || 0), 0);

              const percent =
                totalArea > 0
                  ? Math.round((occupiedArea / totalArea) * 100)
                  : 0;

              return (
                <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Zakupljenost
                  </p>
                  <p className="text-lg font-bold">{percent}%</p>
                </div>
              );
            })()}
            <div className="p-3 bg-gray-50 rounded border border-gray-100 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Godina
              </p>
              <p className="text-lg font-bold">
                {property.godina_izgradnje || "—"}
              </p>
            </div>
          </div>

          {/* Details Sections */}
          <div className="space-y-6">
            <section className="break-inside-avoid">
              <h2 className="text-base font-bold mb-2 border-b border-gray-300 pb-1 uppercase tracking-tight text-gray-800">
                Osnovne informacije
              </h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Katastarska općina</span>
                  <span className="font-medium">
                    {property.katastarska_opcina || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Broj čestice</span>
                  <span className="font-medium">
                    {property.broj_kat_cestice || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Vlasnik</span>
                  <span className="font-medium">{property.vlasnik || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Energetski certifikat</span>
                  <span className="font-medium">
                    {property.energetski_certifikat || "—"}
                  </span>
                </div>
              </div>
            </section>

            <section className="break-inside-avoid">
              <h2 className="text-base font-bold mb-2 border-b border-gray-300 pb-1 uppercase tracking-tight text-gray-800">
                Financijski & Tehnički podaci
              </h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Nabavna cijena</span>
                  <span className="font-medium">
                    {formatCurrency(property.nabavna_cijena)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Zadnja obnova</span>
                  <span className="font-medium">
                    {formatDate(property.zadnja_obnova) || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Amortizacija</span>
                  <span className="font-medium">
                    {formatCurrency(property.amortizacija)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Osiguranje</span>
                  <span className="font-medium">
                    {property.osiguranje || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200 py-1">
                  <span className="text-gray-500">Troškovi održavanja</span>
                  <span className="font-medium">
                    {formatCurrency(property.troskovi_odrzavanja)}
                  </span>
                </div>
              </div>
              {property.potrebna_ulaganja && (
                <div className="mt-2 text-xs bg-amber-50 p-2 rounded border border-amber-100">
                  <span className="block text-amber-800 font-semibold mb-1">
                    Potrebna ulaganja:
                  </span>
                  <p className="text-amber-900">{property.potrebna_ulaganja}</p>
                </div>
              )}
            </section>

            {(property.sudski_sporovi ||
              property.hipoteke ||
              property.napomene) && (
              <section className="break-inside-avoid">
                <h2 className="text-base font-bold mb-2 border-b border-gray-300 pb-1 uppercase tracking-tight text-gray-800">
                  Napomene i Rizici
                </h2>
                <div className="grid grid-cols-1 gap-3 text-xs">
                  {property.sudski_sporovi && (
                    <div className="bg-red-50 p-2 rounded border border-red-100">
                      <span className="block text-red-700 font-bold mb-1">
                        Sudski sporovi
                      </span>
                      <p className="text-red-900">{property.sudski_sporovi}</p>
                    </div>
                  )}
                  {property.hipoteke && (
                    <div className="bg-red-50 p-2 rounded border border-red-100">
                      <span className="block text-red-700 font-bold mb-1">
                        Hipoteke
                      </span>
                      <p className="text-red-900">{property.hipoteke}</p>
                    </div>
                  )}
                  {property.napomene && (
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <span className="block text-gray-700 font-bold mb-1">
                        Napomene
                      </span>
                      <p className="text-gray-800">{property.napomene}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {property.financijska_povijest &&
              property.financijska_povijest.length > 0 && (
                <section className="break-inside-avoid">
                  <h2 className="text-base font-bold mb-2 border-b border-gray-300 pb-1 uppercase tracking-tight text-gray-800">
                    Povijest Financija
                  </h2>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300 bg-gray-50">
                        <th className="text-left py-1 px-2">Godina</th>
                        <th className="text-right py-1 px-2">Prihodi</th>
                        <th className="text-right py-1 px-2">Rashodi</th>
                        <th className="text-right py-1 px-2">Amortizacija</th>
                        <th className="text-right py-1 px-2">Neto Dobit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {property.financijska_povijest.map((item, index) => {
                        const prihodi = parseFloat(item.prihodi) || 0;
                        const rashodi = parseFloat(item.rashodi) || 0;
                        const amortizacija = parseFloat(item.amortizacija) || 0;
                        const neto = prihodi - rashodi + amortizacija;

                        return (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-1 px-2 font-medium">
                              {item.godina}
                            </td>
                            <td className="py-1 px-2 text-right">
                              {formatCurrency(prihodi)}
                            </td>
                            <td className="py-1 px-2 text-right text-red-600">
                              {formatCurrency(rashodi)}
                            </td>
                            <td className="py-1 px-2 text-right text-gray-600">
                              {formatCurrency(amortizacija)}
                            </td>
                            <td
                              className={`py-1 px-2 text-right font-bold ${neto >= 0 ? "text-green-700" : "text-red-700"}`}
                            >
                              {formatCurrency(neto)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}

            {contracts &&
              contracts.filter(
                (c) => c.status === "aktivno" || c.status === "na_isteku",
              ).length > 0 && (
                <section className="break-inside-avoid">
                  <h2 className="text-base font-bold mb-2 border-b border-gray-300 pb-1 uppercase tracking-tight text-gray-800">
                    Aktivni Ugovori
                  </h2>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300 bg-gray-50">
                        <th className="text-left py-1 px-2">Broj Ugovora</th>
                        <th className="text-left py-1 px-2">Zakupnik</th>
                        <th className="text-left py-1 px-2">Trajanje</th>
                        <th className="text-right py-1 px-2">Iznos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts
                        .filter(
                          (c) =>
                            c.status === "aktivno" || c.status === "na_isteku",
                        )
                        .map((contract, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 px-2">
                              <div className="font-bold">
                                {contract.interna_oznaka}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="font-bold">
                                {contract.zakupnik_naziv || "N/A"}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              {formatDate(contract.datum_pocetka)} -{" "}
                              {formatDate(contract.datum_zavrsetka)}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {formatCurrency(contract.osnovna_zakupnina)}
                            </td>
                            <td className="py-2 px-2 text-center uppercase text-[10px]">
                              {contract.status}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-[10px] text-gray-400">
            <span>MK PropTech Management</span>
            <span>Generirano: {new Date().toLocaleDateString("hr-HR")}</span>
          </div>
        </div>
      </div>
    );
  },
);

export default PropertyPrintTemplate;
