import React, { useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Building,
  Users,
  FileText,
  Calendar,
  Wrench,
  Pickaxe,
} from "lucide-react";
import logoMain from "../assets/riforma-logo.png";
import { useAuth } from "../shared/auth";
import { TenantSwitcher } from "./TenantSwitcher";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";

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
    { path: "/projekti", icon: Pickaxe, label: "Projekti" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col gap-3 py-4">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link to="/" className="hidden md:flex items-center gap-3">
                <img
                  src={logoMain}
                  alt="Riforma"
                  className="h-10 w-auto sm:h-12"
                />
              </Link>
            </div>

            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border/60 bg-white/80 backdrop-blur-md px-2 py-1 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:scale-105"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <TenantSwitcher onLogout={handleLogout} />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <img src={logoMain} alt="Riforma" className="h-10 w-auto" />
              </Link>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <div className="flex flex-col gap-6 py-6">
                    <div className="flex flex-col gap-2">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="border-t pt-6">
                      <TenantSwitcher onLogout={handleLogout} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
