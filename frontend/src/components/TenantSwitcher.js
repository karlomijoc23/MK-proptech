import React, { useState, useEffect, useCallback, useMemo, useId } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "./ui/sonner";
import { Settings, ChevronDown, Check, LogOut } from "lucide-react";
import { api } from "../shared/api";
import { useEntityStore } from "../shared/entityStore";
import { canManageTenants } from "../shared/tenantAccess";

const formatRoleLabel = (role) => {
  if (!role) {
    return "";
  }
  const mapping = {
    owner: "Vlasnik",
    admin: "Administrator",
    member: "Član",
    viewer: "Pregled",
    property_manager: "Property manager",
    leasing_agent: "Leasing agent",
    maintenance_coordinator: "Koordinator održavanja",
    accountant: "Financije",
    tenant: "Zakupnik",
    vendor: "Dobavljač",
  };
  return mapping[role] || role;
};

export const TenantSwitcher = ({ onLogout }) => {
  const { tenantId, changeTenant } = useEntityStore();
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantsError, setTenantsError] = useState(null);
  const labelId = useId();
  const navigate = useNavigate();

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const response = await api.getTenants();
      setTenants(response.data || []);
      setTenantsError(null);
    } catch (err) {
      console.error("Greška pri dohvaćanju tenant profila", err);
      setTenantsError(err);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const sortedTenants = useMemo(() => {
    return tenants
      .slice()
      .sort((a, b) => (a.naziv || "").localeCompare(b.naziv || ""));
  }, [tenants]);

  const selectedTenant = useMemo(
    () => sortedTenants.find((tenant) => tenant.id === tenantId),
    [sortedTenants, tenantId],
  );

  const handleSelectTenant = useCallback(
    async (id) => {
      if (!id || id === tenantId) {
        return;
      }
      const resolved = changeTenant(id);
      if (resolved) {
        await loadTenants();
      }
    },
    [changeTenant, loadTenants, tenantId],
  );

  const handleNavigateProfiles = useCallback(() => {
    navigate("/profili");
  }, [navigate]);

  const handleLogout = useCallback(() => {
    onLogout?.();
  }, [onLogout]);

  const buttonLabel =
    selectedTenant?.naziv ||
    (loadingTenants
      ? "Učitavanje profila..."
      : tenantsError
        ? "Profil nije dostupan"
        : tenants.length
          ? "Odaberite profil"
          : "Nema profila");

  return (
    <div className="flex flex-col gap-1 sm:w-auto">
      <Label
        id={labelId}
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:sr-only"
      >
        Aktivni profil
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-border/70 bg-white/90 text-left text-sm font-medium shadow-sm sm:w-[240px]"
            aria-labelledby={labelId}
          >
            <span className="flex flex-col">
              <span className="font-semibold text-foreground">
                {buttonLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuLabel>Moji profili</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loadingTenants && (
            <DropdownMenuItem disabled>Učitavanje...</DropdownMenuItem>
          )}
          {tenantsError && !loadingTenants && (
            <DropdownMenuItem disabled className="text-destructive">
              Nije moguće učitati profile
            </DropdownMenuItem>
          )}
          {!loadingTenants && !tenantsError && sortedTenants.length === 0 && (
            <DropdownMenuItem disabled>Još nema profila</DropdownMenuItem>
          )}
          {sortedTenants.map((tenant) => {
            const isActive = tenant.id === tenantId;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelectTenant(tenant.id);
                }}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {tenant.naziv || "Bez naziva"}
                  </span>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </div>
                {tenant.role && (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatRoleLabel(tenant.role)}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Status: {tenant.status}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              handleNavigateProfiles();
            }}
          >
            <Settings className="mr-2 h-4 w-4" /> Upravljanje profilima
          </DropdownMenuItem>
          {onLogout && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleLogout();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Odjava
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
