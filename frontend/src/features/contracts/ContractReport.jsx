import React, { useEffect, useState, useRef } from "react";
import { api, buildDocumentUrl } from "../../shared/api";
import { formatDate, formatCurrency } from "../../shared/formatters";
import {
  Loader2,
  Printer,
  Download,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { useNavigate } from "react-router-dom";

const ContractReport = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contractsRes, tenantsRes, propertiesRes, documentsRes] =
          await Promise.all([
            api.getUgovori(),
            api.getZakupnici(),
            api.getNekretnine(),
            api.getDokumenti(),
          ]);

        const tenantsMap = new Map(
          tenantsRes.data.map((t) => [String(t.id), t]),
        );
        const propertiesMap = new Map(
          propertiesRes.data.map((p) => [String(p.id), p]),
        );

        // Group documents by contract ID
        const docsByContract = {};
        documentsRes.data.forEach((doc) => {
          if (doc.ugovor_id) {
            // Prefer 'ugovor' type, otherwise take any
            if (!docsByContract[doc.ugovor_id] || doc.tip === "ugovor") {
              docsByContract[doc.ugovor_id] = doc;
            }
          }
        });

        const enrichedContracts = contractsRes.data.map((c) => {
          const tenant = tenantsMap.get(String(c.zakupnik_id));
          const property = propertiesMap.get(String(c.nekretnina_id));

          // Status logic
          let displayStatus = c.status || "Nepoznato";
          if (c.status === "aktivno" && c.datum_zavrsetka) {
            const today = new Date();
            const end = new Date(c.datum_zavrsetka);
            const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            if (diffDays > 0 && diffDays <= 90) {
              displayStatus = "Na isteku";
            }
          }

          return {
            ...c,
            zakupnik_naziv: tenant
              ? tenant.naziv_firme || tenant.ime_prezime
              : "Nepoznat zakupnik",
            nekretnina_naziv: property
              ? property.naziv
              : "Nepoznata nekretnina",
            displayStatus,
            dokument: docsByContract[c.id],
          };
        });

        setContracts(enrichedContracts);
      } catch (error) {
        console.error("Failed to fetch report data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDownloadPdf = async () => {
    const element = reportRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 297; // A4 landscape width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(
        `izvjestaj_ugovori_${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch (error) {
      console.error("PDF generation failed", error);
    }
  };

  // Metrics Calculation
  const activeContracts = contracts.filter((c) => c.status === "aktivno");

  const totalMonthlyValue = activeContracts.reduce(
    (sum, c) => sum + (Number(c.osnovna_zakupnina) || 0),
    0,
  );

  const expiringSoonCount = contracts.filter(
    (c) => c.displayStatus === "Na isteku",
  ).length;

  const indexationNeededCount = activeContracts.filter((c) => {
    if (!c.datum_pocetka) return false;
    return c.indeksacija === true;
  }).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen text-black" ref={reportRef}>
      <div className="flex justify-between items-center mb-8 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/ugovori")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Natrag
          </Button>
          <h1 className="text-2xl font-bold">Izvještaj o ugovorima</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" /> Preuzmi PDF
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Ispiši
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Pregled portfelja</h2>
        <p className="text-sm text-gray-500 mb-4">
          Generirano: {new Date().toLocaleDateString("hr-HR")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ukupna mjesečna vrijednost
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalMonthlyValue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Samo aktivni ugovori
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ugovori na isteku (90 dana)
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiringSoonCount}</div>
              <p className="text-xs text-muted-foreground">
                Zahtijevaju pažnju
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ugovori s indeksacijom
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indexationNeededCount}</div>
              <p className="text-xs text-muted-foreground">
                Ukupno ugovora s klauzulom
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Popis svih ugovora</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2">Broj Ugovora</th>
            <th className="text-left py-2">Zakupnik</th>
            <th className="text-left py-2">Nekretnina</th>
            <th className="text-left py-2">Period</th>
            <th className="text-right py-2">Iznos</th>
            <th className="text-center py-2">Status</th>
            <th className="text-center py-2 no-print">Dokument</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr
              key={c.id}
              className="border-b border-gray-200 break-inside-avoid"
            >
              <td className="py-2 font-mono">{c.broj_ugovora}</td>
              <td className="py-2 font-medium">{c.zakupnik_naziv}</td>
              <td className="py-2">{c.nekretnina_naziv}</td>
              <td className="py-2">
                {formatDate(c.datum_pocetka)} - {formatDate(c.datum_zavrsetka)}
              </td>
              <td className="py-2 text-right">
                {formatCurrency(c.osnovna_zakupnina)}
              </td>
              <td className="py-2 text-center">
                <Badge
                  variant={
                    c.displayStatus === "Na isteku"
                      ? "warning"
                      : c.status === "aktivno"
                        ? "default"
                        : "secondary"
                  }
                  className={`capitalize ${c.displayStatus === "Na isteku" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                >
                  {c.displayStatus}
                </Badge>
              </td>
              <td className="py-2 text-center no-print">
                {c.dokument && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(buildDocumentUrl(c.dokument), "_blank")
                    }
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    body {
                        background: white;
                        -webkit-print-color-adjust: exact;
                    }
                    table {
                        width: 100%;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                }
            `}</style>
    </div>
  );
};

export default ContractReport;
