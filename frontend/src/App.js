import React, { Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "./components/ui/sonner";
import { Loader2 } from "lucide-react";
import "./App.css";
import { AuthProvider, useAuth } from "./shared/auth";
import { EntityStoreProvider } from "./shared/entityStore";
import PageTransition from "./components/PageTransition";
import NekretninePage from "./features/properties/NekretninePage";
import ContractReport from "./features/contracts/ContractReport";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import ZakupniciPage from "./features/tenants/ZakupniciPage";
import TenantProfiles from "./features/tenants/TenantProfiles";
import UgovoriPage from "./features/contracts/UgovoriPage";
import LoginPage from "./features/auth/LoginPage";
import { Navigation } from "./components/Navigation";

const Dashboard = React.lazy(
  () => import("./features/dashboard/DashboardPage"),
);
const ProjectsPage = React.lazy(
  () => import("./features/projects/ProjectsPage"),
);
const ProjectDetailsPage = React.lazy(
  () => import("./features/projects/ProjectDetailsPage"),
);
const ProjectReportPage = React.lazy(
  () => import("./features/projects/ProjectReportPage"),
);

const AppContent = () => {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/10">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          Provjeravam korisničku sesiju…
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  return (
    <EntityStoreProvider>
      <div className="App">
        <Navigation />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              }
            />
            <Route
              path="/nekretnine"
              element={
                <PageTransition>
                  <NekretninePage />
                </PageTransition>
              }
            />
            <Route
              path="/zakupnici"
              element={
                <PageTransition>
                  <ZakupniciPage />
                </PageTransition>
              }
            />
            <Route
              path="/ugovori"
              element={
                <PageTransition>
                  <UgovoriPage />
                </PageTransition>
              }
            />
            <Route
              path="/ugovori/report"
              element={
                <PageTransition>
                  <ContractReport />
                </PageTransition>
              }
            />
            <Route
              path="/projekti"
              element={
                <PageTransition>
                  <ProjectsPage />
                </PageTransition>
              }
            />
            <Route
              path="/projekti/:id"
              element={
                <PageTransition>
                  <ProjectDetailsPage />
                </PageTransition>
              }
            />
            <Route
              path="/projekti/:id/report"
              element={
                <PageTransition>
                  <ProjectReportPage />
                </PageTransition>
              }
            />
            <Route path="/profili" element={<TenantProfiles />} />
            <Route
              path="/odrzavanje"
              element={
                <PageTransition>
                  <MaintenancePage />
                </PageTransition>
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      <Toaster />
    </EntityStoreProvider>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
