import React, { useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Building,
  Users,
  FileText,
  Calendar,
  Wrench,
} from "lucide-react";
import logoMain from "../assets/riforma-logo.png";
import { useAuth } from "../shared/auth";
import { TenantSwitcher } from "./TenantSwitcher";

export const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const navItems = [
    { path: "/", icon: Home, label: "Dashboard" },
    { path: "/nekretnine", icon: Building, label: "Nekretnine" },
    { path: "/zakupnici", icon: Users, label: "Zakupnici" },
    { path: "/ugovori", icon: Calendar, label: "Ugovori" },
    { path: "/odrzavanje", icon: Wrench, label: "Održavanje" },
    { path: "/dokumenti", icon: FileText, label: "Dokumenti" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <img
                  src={logoMain}
                  alt="Riforma"
                  className="h-10 w-auto sm:h-12"
                />
              </Link>
              <div className="hidden md:flex items-center gap-1 rounded-full border border-border/60 bg-white/80 px-2 py-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <TenantSwitcher onLogout={handleLogout} />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-xl border border-border/60 bg-white/80 p-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <TenantSwitcher onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
