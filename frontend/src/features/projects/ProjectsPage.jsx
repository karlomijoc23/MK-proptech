import React from "react";
import { Button } from "../../components/ui/button";
import { Rocket, Hammer, Construction } from "lucide-react";
import { Link } from "react-router-dom";

export default function ProjectsPage() {
  return (
    <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-6 text-center animate-in fade-in-50">
      <div className="mb-8 relative">
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl"></div>
        <div className="relative rounded-full bg-white p-6 shadow-lg border">
          <Construction className="h-16 w-16 text-primary" />
        </div>
      </div>

      <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
        Projekti
      </h1>

      <div className="mb-8 max-w-lg space-y-2">
        <p className="text-lg text-slate-600">
          Modul za upravljanje investicijama i fazama razvoja je trenutno u
          izradi.
        </p>
        <p className="text-sm text-slate-500">
          Uskoro ćemo omogućiti detaljno praćenje projekata, Gantt grafikone
          (v2), financijsku analitiku i pravnu dokumentaciju na jednom mjestu.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link to="/">Povratak na nadzornu ploču</Link>
        </Button>
      </div>

      <div className="mt-12">
        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Rocket className="mr-1.5 h-3 w-3" />
          Dolazi uskoro u v2.0
        </span>
      </div>
    </div>
  );
}

/* 
// ORIGINAL CODE PRESERVED FOR FUTURE USE
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Calendar, FileText, ArrowRight, Loader2 } from "lucide-react";
// ... (rest of original imports)

// ... (rest of original logic)
*/
