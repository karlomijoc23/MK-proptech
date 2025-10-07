import React from "react";
import { buildDocumentUrl } from "../../../shared/api";

const DocumentViewer = ({ dokument, heightClass = "h-[60vh] md:h-[72vh]" }) => {
  if (!dokument || !dokument.putanja_datoteke) {
    return (
      <div
        className={`flex ${heightClass} items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 text-sm text-muted-foreground/80`}
      >
        PDF nije dostupan. Preuzmite datoteku putem opcije ispod.
      </div>
    );
  }

  const viewerUrl = `${buildDocumentUrl(dokument)}#toolbar=0&view=FitH`;

  return (
    <div
      data-document-preview
      className={`w-full overflow-hidden rounded-xl border border-border/60 bg-white shadow-inner ${heightClass}`}
    >
      <object
        data={viewerUrl}
        type="application/pdf"
        className="h-full w-full"
        style={{ border: "none" }}
      >
        <iframe
          src={viewerUrl}
          title={`Pregled: ${dokument.naziv}`}
          className="h-full w-full"
          loading="lazy"
          style={{ border: "none" }}
        />
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground/80">
          Pregled nije podržan u ovom pregledniku. Koristite gumb za otvaranje u
          novom prozoru.
        </div>
      </object>
    </div>
  );
};

export default DocumentViewer;
