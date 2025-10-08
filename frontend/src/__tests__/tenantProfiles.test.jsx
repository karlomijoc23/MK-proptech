import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";

jest.mock("../shared/api", () => ({
  api: {
    getTenants: jest.fn(),
    getTenant: jest.fn(),
    updateTenant: jest.fn(),
    createTenant: jest.fn(),
    getUsers: jest.fn(),
    registerUser: jest.fn(),
  },
}));

const { api } = require("../shared/api");

jest.mock("../shared/entityStore", () => ({
  useEntityStore: jest.fn(),
}));

const { useEntityStore } = require("../shared/entityStore");

jest.mock("../components/ui/sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

import TenantProfiles from "../features/tenants/TenantProfiles";

const TENANTS_PAYLOAD = [
  {
    id: "tenant-default",
    naziv: "Primarni profil",
    status: "active",
    role: "owner",
    tip: "company",
  },
  {
    id: "tenant-2",
    naziv: "Drugi profil",
    status: "active",
    role: "member",
    tip: "company",
  },
];

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  api.getTenants.mockResolvedValue({ data: TENANTS_PAYLOAD });
  api.getTenant.mockResolvedValue({
    data: {
      id: "tenant-default",
      naziv: "Primarni profil",
      tip: "company",
      status: "active",
      oib: "12345678901",
      iban: "HR123",
    },
  });
  api.updateTenant.mockResolvedValue({});
  api.createTenant.mockResolvedValue({
    data: { id: "tenant-3", naziv: "Novi profil" },
  });
  api.getUsers.mockResolvedValue({ data: [] });
  api.registerUser.mockResolvedValue({ data: { id: "user-1" } });
  useEntityStore.mockReturnValue({
    tenantId: "tenant-default",
    changeTenant: jest.fn((id) => id),
  });
});

test("allows editing and saving tenant details", async () => {
  render(<TenantProfiles />);

  await waitFor(() =>
    expect(api.getTenant).toHaveBeenCalledWith("tenant-default"),
  );

  const nameInput = await screen.findByLabelText(/Naziv profila/i);
  fireEvent.change(nameInput, { target: { value: "Primarni HUB" } });

  const saveButton = screen.getByRole("button", { name: /Spremi promjene/i });
  fireEvent.click(saveButton);

  await waitFor(() =>
    expect(api.updateTenant).toHaveBeenCalledWith("tenant-default", {
      naziv: "Primarni HUB",
      tip: "company",
      status: "active",
      oib: "12345678901",
      iban: "HR123",
    }),
  );
});

test("handles creation of a new profile", async () => {
  const changeTenantMock = jest.fn((id) => id);
  useEntityStore.mockReturnValue({
    tenantId: "tenant-default",
    changeTenant: changeTenantMock,
  });

  render(<TenantProfiles />);

  await waitFor(() => expect(api.getTenants).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("button", { name: /Dodaj profil/i }));

  const dialog = await screen.findByRole("dialog");
  const createNameInput = within(dialog).getByLabelText(/Naziv profila/i);
  fireEvent.change(createNameInput, { target: { value: "Ops profil" } });

  const createButton = within(dialog).getByRole("button", {
    name: /Kreiraj profil/i,
  });
  fireEvent.click(createButton);

  await waitFor(() =>
    expect(api.createTenant).toHaveBeenCalledWith({
      naziv: "Ops profil",
      tip: "company",
      oib: null,
      iban: null,
    }),
  );
  expect(changeTenantMock).toHaveBeenCalledWith("tenant-3");
});

test("allows administrators to invite a new user", async () => {
  render(<TenantProfiles />);

  await waitFor(() => expect(api.getUsers).toHaveBeenCalled());

  const emailInput = screen.getByLabelText(/Email adresa/i);
  fireEvent.change(emailInput, { target: { value: "novi@tvrtka.hr" } });

  const nameInput = screen.getByLabelText(/Ime i prezime/i);
  fireEvent.change(nameInput, { target: { value: "Novi Korisnik" } });

  const passwordInput = screen.getByLabelText(/Privremena lozinka/i);
  fireEvent.change(passwordInput, { target: { value: "tajna123" } });

  fireEvent.click(screen.getByRole("button", { name: /Dodaj korisnika/i }));

  await waitFor(() =>
    expect(api.registerUser).toHaveBeenCalledWith({
      email: "novi@tvrtka.hr",
      password: "tajna123",
      full_name: "Novi Korisnik",
      role: "tenant",
    }),
  );
});
