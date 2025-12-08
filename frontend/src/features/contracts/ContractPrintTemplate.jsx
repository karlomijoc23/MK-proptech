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
                        font-family: sans-serif;
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
              <p className="text-xs text-gray-500">MK Proptech Management</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Generirano: {new Date().toLocaleDateString("hr-HR")}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-gray-50/50">
                <th className="text-left py-2 px-1 w-[10%]">Broj Ugovora</th>
                <th className="text-left py-2 px-1 w-[15%]">
                  Zakupnik / Kontakt
                </th>
                <th className="text-left py-2 px-1 w-[15%]">Nekretnina</th>
                <th className="text-left py-2 px-1 w-[15%]">Period</th>
                <th className="text-right py-2 px-1 w-[10%]">
                  Mjesečna
                  <br />
                  Zakupnina
                </th>
                <th className="text-right py-2 px-1 w-[10%]">
                  Jamčevina
                  <br />
                  Depozit
                </th>
                <th className="text-center py-2 px-1 w-[10%]">Indeksacija</th>
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
                    <td className="py-2 px-1 font-mono font-medium align-top">
                      {c.interna_oznaka}
                    </td>

                    <td className="py-2 px-1 align-top">
                      <div className="font-bold text-gray-900">
                        {c.zakupnik_naziv}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5 truncate max-w-[150px]">
                        {contactInfo}
                      </div>
                    </td>

                    <td className="py-2 px-1 align-top text-gray-700">
                      {propertyName}
                    </td>

                    <td className="py-2 px-1 align-top">
                      <div className="flex flex-col">
                        <span>{formatDate(c.datum_pocetka)}</span>
                        <span className="text-gray-400 text-[9px]">do</span>
                        <span>{formatDate(c.datum_zavrsetka)}</span>
                      </div>
                    </td>

                    <td className="py-2 px-1 text-right align-top font-medium">
                      {formatCurrency(c.osnovna_zakupnina)}
                    </td>

                    <td className="py-2 px-1 text-right align-top text-gray-600">
                      {c.polog_depozit ? formatCurrency(c.polog_depozit) : "—"}
                    </td>

                    <td className="py-2 px-1 text-center align-top text-xs">
                      {c.indeksacija ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-4 px-1"
                        >
                          {indexationInfo}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
