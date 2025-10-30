import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

jest.mock("../shared/api", () => ({
  api: {
    getTenants: jest.fn().mockResolvedValue({
      data: [
        { id: "tenant-default", naziv: "Primarni profil", role: "owner" },
        { id: "tenant-2", naziv: "Drugi profil", role: "member" },
      ],
    }),
  },
}));

const { api } = require("../shared/api");

jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");
    return {
      BrowserRouter: ({ children }) => <div>{children}</div>,
      Routes: ({ children }) => <>{children}</>,
      Route: ({ element }) => element,
      Link: ({ children }) => <a href="#">{children}</a>,
      useNavigate: () => jest.fn(),
      useLocation: () => ({ pathname: "/" }),
      useParams: () => ({}),
    };
  },
  { virtual: true },
);

jest.mock("../shared/entityStore", () => ({
  useEntityStore: jest.fn(),
}));

const { useEntityStore } = require("../shared/entityStore");

jest.mock("../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect, ...props }) => (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => onSelect?.(event)}
      {...props}
    >
      {children}
    </button>
  ),
}));
jest.mock("../components/ui/sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

const { toast } = require("../components/ui/sonner");

import { TenantSwitcher } from "../App";

let originalLocation;

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  originalLocation = window.location;
  delete window.location;
  const mockedLocation = Object.create(originalLocation);
  Object.defineProperty(mockedLocation, "reload", {
    configurable: true,
    value: jest.fn(),
  });
  window.location = mockedLocation;
});

beforeEach(() => {
  api.getTenants.mockResolvedValue({
    data: [
      { id: "tenant-default", naziv: "Primarni profil", role: "owner" },
      { id: "tenant-2", naziv: "Drugi profil", role: "member" },
    ],
  });
  useEntityStore.mockReset();
  toast.mockClear();
  window.location.reload.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  delete window.location;
  window.location = originalLocation;
});

it("loads tenants and triggers change handler", async () => {
  const storeMock = {
    tenantId: "tenant-default",
    changeTenant: jest.fn().mockReturnValue("tenant-2"),
  };
  useEntityStore.mockReturnValue(storeMock);

  render(<TenantSwitcher />);

  await waitFor(() => expect(api.getTenants).toHaveBeenCalled());

  const trigger = await screen.findByRole("button", {
    name: /Aktivni profil/i,
  });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  const option = await screen.findByRole("menuitem", { name: /Drugi profil/i });
  fireEvent.click(option);

  await waitFor(() =>
    expect(storeMock.changeTenant).toHaveBeenCalledWith("tenant-2"),
  );
  await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
});

it("disables profile management for non-admin roles", async () => {
  const storeMock = {
    tenantId: "tenant-2",
    changeTenant: jest.fn().mockReturnValue("tenant-3"),
  };
  useEntityStore.mockReturnValue(storeMock);

  render(<TenantSwitcher />);

  await waitFor(() => expect(api.getTenants).toHaveBeenCalled());

  const trigger = await screen.findByRole("button", {
    name: /Aktivni profil/i,
  });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  const manageItem = await screen.findByRole("menuitem", {
    name: /Upravljanje profilima/i,
  });
  fireEvent.click(manageItem);

  await waitFor(() => expect(toast).toHaveBeenCalled());
});
