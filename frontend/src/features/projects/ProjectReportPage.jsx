import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../shared/api";
import { formatCurrency, formatDate } from "../../shared/formatters";
import { Loader2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";

export default function ProjectReportPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getProject(id);
        setProject(res.data);
      } catch (err) {
        console.error("Failed to load project", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) return <div>Projekt nije pronađen.</div>;

  return (
    <div className="container mx-auto max-w-4xl p-8 bg-white print:p-0">
      {/* Header */}
      <div className="mb-8 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-gray-500">Izvješće o statusu projekta</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Datum izvješća:</p>
            <p className="font-medium">{formatDate(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-500">Budžet</p>
          <p className="text-xl font-bold">
            {formatCurrency(project.budget || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-500">Potrošeno</p>
          <p className="text-xl font-bold">
            {formatCurrency(project.spent || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-500">Status</p>
          <Badge className="mt-1">{project.status}</Badge>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8">
        <h2 className="mb-2 text-xl font-semibold border-b pb-2">
          Opis Projekta
        </h2>
        <p className="text-gray-700">{project.description || "Nema opisa."}</p>
      </div>

      {/* Timeline */}
      <div className="mb-8 break-inside-avoid">
        <h2 className="mb-4 text-xl font-semibold border-b pb-2">
          Faze Realizacije
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">Faza</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {project.phases?.map((phase, idx) => (
              <tr key={phase.id || idx} className="border-b last:border-0">
                <td className="py-2 font-medium">{phase.name}</td>
                <td className="py-2 text-gray-600">
                  {formatDate(phase.start_date)} - {formatDate(phase.end_date)}
                </td>
                <td className="py-2">
                  <Badge variant="outline">{phase.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Finances */}
      <div className="mb-8 break-inside-avoid">
        <h2 className="mb-4 text-xl font-semibold border-b pb-2">
          Financijski Pregled (Transakcije)
        </h2>
        {project.transactions && project.transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Datum</th>
                <th className="pb-2">Kategorija</th>
                <th className="pb-2">Opis</th>
                <th className="pb-2 text-right">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {project.transactions.map((tx, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-2">{formatDate(tx.date)}</td>
                  <td className="py-2 capitalize">{tx.category}</td>
                  <td className="py-2 text-gray-600">{tx.description}</td>
                  <td
                    className={`py-2 text-right font-medium ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">Nema transakcija.</p>
        )}
      </div>

      {/* Legal Docs */}
      <div className="mb-8 break-inside-avoid">
        <h2 className="mb-4 text-xl font-semibold border-b pb-2">
          Pravna Dokumentacija
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {project.documents?.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded border p-2 text-sm"
            >
              <span className="font-medium">
                {doc.name} ({doc.type})
              </span>
              <Badge
                variant={doc.status === "approved" ? "success" : "secondary"}
              >
                {doc.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t pt-4 text-center text-sm text-gray-400 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          Isprintaj / Spremi kao PDF
        </button>
      </div>

      <style type="text/css" media="print">
        {`
                @page { size: A4; margin: 2cm; }
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                `}
      </style>
    </div>
  );
}
