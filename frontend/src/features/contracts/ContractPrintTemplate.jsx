import React, { forwardRef } from "react";
import { formatDate, formatCurrency } from "../../shared/formatters";
import { Badge } from "../../components/ui/badge";

const ContractPrintTemplate = forwardRef(
  ({ contracts, nekretnine, zakupnici }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black print:w-full print:h-auto w-[297mm] min-h-[210mm] mx-auto"
      >
        <style type="text/css" media="print">
          {`
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-family: 'Inter', sans-serif;
                    }
                    th { font-size: 11px; }
                    td { font-size: 10px; }
                `}
        </style>
        <div className="p-8 print:p-0">
          <div className="mb-6 flex justify-between items-center border-b pb-4">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight">
                Izvještaj o ugovorima
              </h1>
              <p className="text-xs text-gray-500 font-medium tracking-wide">
                Riforma Real Estate Management
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Generirano: {new Date().toLocaleDateString("hr-HR")}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-100">
                <th className="text-left p-3 font-semibold text-gray-600 w-[12%] uppercase tracking-wider">
                  Broj Ugovora
                </th>
                <th className="text-left p-3 font-semibold text-gray-600 w-[20%] uppercase tracking-wider">
                  Zakupnik / Kontakt
                </th>
                <th className="text-left p-3 font-semibold text-gray-600 w-[18%] uppercase tracking-wider">
                  Nekretnina
                </th>
                <th className="text-left p-3 font-semibold text-gray-600 w-[15%] uppercase tracking-wider">
                  Period
                </th>
                <th className="text-right p-3 font-semibold text-gray-600 w-[12%] uppercase tracking-wider">
                  Mj. Zakupnina
                </th>
                <th className="text-right p-3 font-semibold text-gray-600 w-[12%] uppercase tracking-wider">
                  Jamčevina
                </th>
                <th className="text-center p-3 font-semibold text-gray-600 w-[11%] uppercase tracking-wider">
                  Indeksacija
                </th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const propertyName =
                  nekretnine?.find((n) => n.id === c.nekretnina_id)?.naziv ||
                  "—";
                const zakupnik = zakupnici?.find((z) => z.id === c.zakupnik_id);

                // Contact Logic: Email priority, then phone
                const contactInfo =
                  zakupnik?.email || zakupnik?.telefon || zakupnik?.oib || "—";
                const indexationInfo = c.indeksacija ? c.indeks || "Da" : "Ne";
                // For indexing date, if not present, show status or formula

                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 break-inside-avoid hover:bg-gray-50/30"
                  >
                    <td className="p-3 font-mono font-medium text-gray-600 align-top">
                      {c.interna_oznaka}
                    </td>

                    <td className="p-3 align-top">
                      <div className="font-bold text-gray-900 break-words">
                        {c.zakupnik_naziv}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 truncate max-w-[200px]">
                        {contactInfo}
                      </div>
                    </td>

                    <td className="p-3 align-top text-gray-700 font-medium break-words">
                      {propertyName}
                    </td>

                    <td className="p-3 align-top text-gray-600">
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap">
                          Od: {formatDate(c.datum_pocetka)}
                        </span>
                        <span className="whitespace-nowrap">
                          Do: {formatDate(c.datum_zavrsetka)}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 align-top text-right font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrency(c.osnovna_zakupnina)}
                    </td>

                    <td className="p-3 align-top text-right text-gray-600 whitespace-nowrap">
                      {c.iznos_jamcevine > 0
                        ? formatCurrency(c.iznos_jamcevine)
                        : "—"}
                    </td>

                    <td className="p-3 align-top text-center">
                      {/* Simplified Badge */}
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                          c.indeksacija
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {indexationInfo}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
            <span>Ukupno ugovora: {contracts.length}</span>
            <span>Stranica 1 od 1</span>
          </div>
        </div>
      </div>
    );
  },
);

export default ContractPrintTemplate;
