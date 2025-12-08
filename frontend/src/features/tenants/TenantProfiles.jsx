import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../shared/auth";
import { useEntityStore } from "../../shared/entityStore";
import { api } from "../../shared/api";
import { toast } from "../../components/ui/sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Loader2, Plus, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { ScrollArea } from "../../components/ui/scroll-area";
import { canManageTenants } from "../../shared/tenantAccess";

const TENANT_TYPE_OPTIONS = [
  { value: "company", label: "Tvrtka" },
  { value: "personal", label: "Osoba" },
];

const TENANT_STATUS_OPTIONS = [
  { value: "active", label: "Aktivan" },
  { value: "archived", label: "Arhiviran" },
];

const emptyForm = {
  naziv: "",
  tip: "company",
  status: "active",
  oib: "",
  iban: "",
};

const emptyCreateForm = {
  naziv: "",
  tip: "company",
  oib: "",
  iban: "",
};

const emptyInviteForm = {
  email: "",
  full_name: "",
  role: "tenant",
  password: "",
  tenantId: "",
};

const formatLabel = (tenant) => {
  if (!tenant) {
    return "Nepoznat profil";
  }
  if (tenant.tip === "personal") {
    return tenant.naziv || tenant.ime || tenant.id;
  }
  return tenant.naziv;
};

const TenantProfiles = () => {
  const { tenantId, changeTenant } = useEntityStore();
  const [tenants, setTenants] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviting, setInviting] = useState(false);

  const { user } = useAuth();

  const activeSummary = useMemo(
    () => tenants.find((item) => item.id === tenantId),
    [tenants, tenantId],
  );

  const canCreateProfiles = useMemo(() => {
    if (user?.role === "admin" || user?.role === "owner") return true;
    return canManageTenants(activeSummary?.role);
  }, [activeSummary?.role, user?.role]);
  const canManageUsers = canCreateProfiles;

  const loadTenants = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await api.getTenants();
      setTenants(response.data || []);
    } catch (err) {
      console.error("Greška pri učitavanju profila", err);
      toast.error("Nije moguće učitati profile.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadTenantDetail = useCallback(async (id) => {
    if (!id) {
      setFormState(emptyForm);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await api.getTenant(id);
      const data = response.data || {};
      setFormState({
        naziv: data.naziv || "",
        tip: data.tip || "company",
        status: data.status || "active",
        oib: data.oib || "",
        iban: data.iban || "",
      });
    } catch (err) {
      console.error("Greška pri učitavanju profila", err);
      toast.error("Profil nije moguće učitati.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (!selectedTenantId && tenants.length) {
      const fallback =
        tenants.find((item) => item.id === tenantId)?.id || tenants[0].id;
      setSelectedTenantId(fallback);
      return;
    }
    if (selectedTenantId) {
      loadTenantDetail(selectedTenantId);
    }
  }, [selectedTenantId, tenants, tenantId, loadTenantDetail]);

  const handleRefresh = useCallback(async () => {
    await loadTenants();
    if (selectedTenantId) {
      await loadTenantDetail(selectedTenantId);
    }
  }, [loadTenants, loadTenantDetail, selectedTenantId]);

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) {
      setUsers([]);
      setUsersError(null);
      return;
    }
    setLoadingUsers(true);
    try {
      const response = await api.getUsers();
      setUsers(response.data || []);
      setUsersError(null);
    } catch (err) {
      console.error("Greška pri učitavanju korisnika", err);
      setUsers([]);
      setUsersError(err);
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSelectTenant = (id) => {
    setSelectedTenantId(id);
    setInviteForm((prev) => ({ ...prev, tenantId: id }));
  };

  const handleSetActive = async (id) => {
    const resolved = changeTenant(id);
    if (resolved) {
      toast.success("Aktivni profil je promijenjen.");
      setSelectedTenantId(resolved);
      if (typeof window !== "undefined" && window.location?.reload) {
        window.location.reload();
        return;
      }
      await handleRefresh();
    }
  };

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedTenantId) {
      return;
    }
    if (!canEditSelected) {
      toast.error("Nemate ovlasti za uređivanje ovog profila.");
      return;
    }
    setSaving(true);
    try {
      await api.updateTenant(selectedTenantId, {
        naziv: formState.naziv.trim() || null,
        tip: formState.tip,
        status: formState.status,
        oib: formState.oib.trim() || null,
        iban: formState.iban.trim() || null,
      });
      toast.success("Profil je ažuriran.");
      await handleRefresh();
    } catch (err) {
      console.error("Greška pri spremanju profila", err);
      toast.error("Spremanje nije uspjelo.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.naziv.trim()) {
      toast.error("Naziv profila je obavezan.");
      return;
    }
    if (!canCreateProfiles) {
      toast.error("Samo administratori mogu kreirati nove profile.");
      return;
    }
    setCreating(true);
    try {
      const response = await api.createTenant({
        naziv: createForm.naziv.trim(),
        tip: createForm.tip,
        oib: createForm.oib.trim() || null,
        iban: createForm.iban.trim() || null,
      });
      const created = response.data;
      toast.success("Novi profil je kreiran.");
      setCreateForm(emptyCreateForm);
      setIsCreateOpen(false);
      await loadTenants();
      if (created?.id) {
        changeTenant(created.id);
        setSelectedTenantId(created.id);
      }
    } catch (err) {
      console.error("Greška pri kreiranju profila", err);
      toast.error("Kreiranje profila nije uspjelo.");
    } finally {
      setCreating(false);
    }
  };

  const handleInviteFieldChange = (key, value) => {
    setInviteForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.password.trim()) {
      toast.error("Email i lozinka su obavezni.");
      return;
    }
    setInviting(true);
    try {
      const registerRes = await api.registerUser({
        email: inviteForm.email.trim(),
        password: inviteForm.password,
        full_name: inviteForm.full_name.trim() || undefined,
        role: inviteForm.role,
      });

      const newUser = registerRes.data;

      // Assign to selected tenant
      const targetTenantId = inviteForm.tenantId || selectedTenantId;
      if (targetTenantId && newUser?.id) {
        try {
          await api.addTenantMember(targetTenantId, {
            user_id: newUser.id,
            role: "member", // Default role
          });
          toast.success("Korisnik je dodan u profil.");
        } catch (assignErr) {
          console.error("Failed to assign user to tenant", assignErr);
          toast.warning("Korisnik je kreiran, ali nije dodan u profil.");
        }
      }

      toast.success("Korisnik je uspješno registriran.");
      setInviteForm(emptyInviteForm);
      await loadUsers();
    } catch (err) {
      console.error("Greška pri dodavanju korisnika", err);
      const message =
        err?.response?.data?.detail || "Dodavanje korisnika nije uspjelo.";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const sortedTenants = useMemo(() => {
    return tenants.slice().sort((a, b) => a.naziv.localeCompare(b.naziv));
  }, [tenants]);

  const selectedSummary = useMemo(
    () => sortedTenants.find((item) => item.id === selectedTenantId),
    [sortedTenants, selectedTenantId],
  );

  const canEditSelected = useMemo(
    () => canManageTenants(selectedSummary?.role),
    [selectedSummary?.role],
  );

  const detailFieldPrefix = useMemo(
    () => (selectedTenantId ? `tenant-${selectedTenantId}` : "tenant-detail"),
    [selectedTenantId],
  );
  const createFieldPrefix = "tenant-create";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            Upravljanje profilima
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pregledajte dostupne profile, uredite poslovne podatke i odaberite
            aktivni kontekst za rad.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={!canCreateProfiles}
            variant={canCreateProfiles ? "default" : "outline"}
          >
            <Plus className="mr-2 h-4 w-4" /> Dodaj profil
          </Button>
          {!canCreateProfiles && (
            <span className="text-xs text-muted-foreground">
              Samo vlasnici ili administratori mogu dodavati nove profile.
            </span>
          )}
        </div>
      </div>

      {!canCreateProfiles && (
        <Alert className="mt-6 border-amber-300/60 bg-amber-50 text-amber-900">
          <AlertTitle>Pristup samo za čitanje</AlertTitle>
          <AlertDescription>
            Imate pristup portfelju, ali bez administrativnih ovlasti. Profil
            možete pregledavati, no za dodavanje novih profila ili promjenu
            poslovnih podataka obratite se vlasniku ili administratoru.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px,1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Moji profili
            </CardTitle>
            <CardDescription>
              {loadingList
                ? "Učitavanje profila..."
                : "Odaberite profil za pregled i uređivanje."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedTenants.map((tenant) => {
              const isActive = tenant.id === tenantId;
              const isSelected = tenant.id === selectedTenantId;
              return (
                <div
                  key={tenant.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTenant(tenant.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelectTenant(tenant.id);
                    }
                  }}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-foreground">
                      {formatLabel(tenant)}
                    </div>
                    {tenant.role && (
                      <Badge variant="outline" className="uppercase">
                        {tenant.role}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Status: {tenant.status}</span>
                    {isActive ? (
                      <Badge variant="secondary">Aktivni</Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSetActive(tenant.id);
                        }}
                      >
                        Postavi aktivni
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!loadingList && sortedTenants.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Još uvijek nemate kreirane profile.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Detalji profila</CardTitle>
            <CardDescription>
              Uredite osnovne podatke i spremite promjene za odabrani profil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Učitavanje podataka profila...
              </div>
            ) : selectedSummary ? (
              <>
                {!canEditSelected && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                    Ovaj profil je dostupan samo za pregled. Kontaktirajte
                    administratora kako biste dobili ovlasti za izmjene.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                      htmlFor={`${detailFieldPrefix}-name`}
                    >
                      Naziv profila
                    </label>
                    <Input
                      id={`${detailFieldPrefix}-name`}
                      value={formState.naziv}
                      disabled={!canEditSelected}
                      onChange={(event) =>
                        handleFieldChange("naziv", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                      htmlFor={`${detailFieldPrefix}-type`}
                    >
                      Tip profila
                    </label>
                    <Select
                      value={formState.tip}
                      disabled={!canEditSelected}
                      onValueChange={(value) => handleFieldChange("tip", value)}
                    >
                      <SelectTrigger id={`${detailFieldPrefix}-type`}>
                        <SelectValue placeholder="Odaberite tip" />
                      </SelectTrigger>
                      <SelectContent>
                        {TENANT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                      htmlFor={`${detailFieldPrefix}-status`}
                    >
                      Status
                    </label>
                    <Select
                      value={formState.status}
                      disabled={!canEditSelected}
                      onValueChange={(value) =>
                        handleFieldChange("status", value)
                      }
                    >
                      <SelectTrigger id={`${detailFieldPrefix}-status`}>
                        <SelectValue placeholder="Odaberite status" />
                      </SelectTrigger>
                      <SelectContent>
                        {TENANT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                      htmlFor={`${detailFieldPrefix}-oib`}
                    >
                      OIB
                    </label>
                    <Input
                      id={`${detailFieldPrefix}-oib`}
                      value={formState.oib}
                      disabled={!canEditSelected}
                      onChange={(event) =>
                        handleFieldChange("oib", event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                    htmlFor={`${detailFieldPrefix}-iban`}
                  >
                    IBAN
                  </label>
                  <Input
                    id={`${detailFieldPrefix}-iban`}
                    value={formState.iban}
                    disabled={!canEditSelected}
                    onChange={(event) =>
                      handleFieldChange("iban", event.target.value)
                    }
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadTenantDetail(selectedTenantId)}
                    disabled={detailLoading || saving}
                  >
                    Osvježi
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !canEditSelected}
                  >
                    {saving ? "Spremam..." : "Spremi promjene"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Odaberite profil s lijeve strane kako biste uredili podatke.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {canManageUsers && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Dodavanje korisnika</CardTitle>
            <CardDescription>
              Dodajte nove korisnike sustava s unaprijed definiranim ovlastima.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1.1fr,1fr]">
            <form className="space-y-4" onSubmit={handleInvite}>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor="invite-email"
                >
                  Email adresa
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    handleInviteFieldChange("email", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor="invite-name"
                >
                  Ime i prezime
                </label>
                <Input
                  id="invite-name"
                  value={inviteForm.full_name}
                  onChange={(event) =>
                    handleInviteFieldChange("full_name", event.target.value)
                  }
                  placeholder="Opcionalno"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor="invite-tenant"
                >
                  Profil
                </label>
                <Select
                  value={inviteForm.tenantId}
                  onValueChange={(value) =>
                    handleInviteFieldChange("tenantId", value)
                  }
                >
                  <SelectTrigger id="invite-tenant">
                    <SelectValue placeholder="Odaberite profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {formatLabel(tenant)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor="invite-password"
                >
                  Privremena lozinka
                </label>
                <Input
                  id="invite-password"
                  type="password"
                  value={inviteForm.password}
                  onChange={(event) =>
                    handleInviteFieldChange("password", event.target.value)
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={inviting} className="w-full">
                {inviting ? "Spremam..." : "Dodaj korisnika"}
              </Button>
            </form>
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  Trenutni korisnici
                </h4>
                <p className="text-xs text-muted-foreground">
                  Korisnici s pristupom platformi. Novi korisnik automatski
                  dobiva pristup aktivnom portfelju.
                </p>
              </div>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Učitavanje
                  korisnika...
                </div>
              ) : usersError ? (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertDescription>
                    Nije moguće učitati listu korisnika.
                  </AlertDescription>
                </Alert>
              ) : users.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Još nema dodanih korisnika.
                </p>
              ) : (
                <ScrollArea className="max-h-56 rounded-lg border border-border/60">
                  <ul className="divide-y divide-border/60">
                    {users.map((user) => (
                      <li key={user.id} className="p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {user.full_name || user.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                          <Badge variant="outline" className="uppercase">
                            {user.role}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Status: {user.active ? "aktivan" : "blokiran"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi profil</DialogTitle>
            <DialogDescription>
              Kreirajte dodatni poslovni profil kako biste odvojili podatke i
              pristupne uloge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                htmlFor={`${createFieldPrefix}-name`}
              >
                Naziv profila
              </label>
              <Input
                id={`${createFieldPrefix}-name`}
                value={createForm.naziv}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    naziv: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor={`${createFieldPrefix}-type`}
                >
                  Tip profila
                </label>
                <Select
                  value={createForm.tip}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, tip: value }))
                  }
                >
                  <SelectTrigger id={`${createFieldPrefix}-type`}>
                    <SelectValue placeholder="Odaberite tip" />
                  </SelectTrigger>
                  <SelectContent>
                    {TENANT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor={`${createFieldPrefix}-oib`}
                >
                  OIB
                </label>
                <Input
                  id={`${createFieldPrefix}-oib`}
                  value={createForm.oib}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      oib: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                htmlFor={`${createFieldPrefix}-iban`}
              >
                IBAN
              </label>
              <Input
                id={`${createFieldPrefix}-iban`}
                value={createForm.iban}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    iban: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={creating}
            >
              Odustani
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Spremam..." : "Kreiraj profil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantProfiles;
