import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");
    return {
      BrowserRouter: ({ children }) => <div>{children}</div>,
      Routes: ({ children }) => <>{children}</>,
      Route: ({ element }) => element,
      Link: ({ children, to }) => (
        <a href={typeof to === "string" ? to : "#"}>{children}</a>
      ),
      useNavigate: () => jest.fn(),
      useLocation: () => ({ pathname: "/" }),
      useParams: () => ({}),
    };
  },
  { virtual: true },
);

jest.mock(
  "axios",
  () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  "jspdf",
  () => ({
    default: function jsPDF() {},
  }),
  { virtual: true },
);

jest.mock(
  "@/lib/utils",
  () => ({
    cn: (...classes) => classes.filter(Boolean).join(" "),
  }),
  { virtual: true },
);

import { Zakupnici as ZakupniciView, EntityStoreContext } from "../App";

jest.mock("sonner", () => {
  const toast = Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  });
  return { toast };
});

const defaultTenants = [
  {
    id: "1",
    naziv_firme: "Alpha d.o.o.",
    ime_prezime: null,
    oib: "12345678901",
    sjediste: "Zagreb",
    kontakt_ime: "Ana",
    kontakt_email: "ana@example.com",
    kontakt_telefon: "+385123456",
    iban: "HR1210010051863000160",
  },
  {
    id: "2",
    naziv_firme: "Beta LLC",
    ime_prezime: null,
    oib: "22222222222",
    sjediste: "Split",
    kontakt_ime: "Bruno",
    kontakt_email: "kontakt@beta.hr",
    kontakt_telefon: "+385987654",
    iban: null,
  },
];

function renderZakupnici(tenants = defaultTenants) {
  return render(
    <EntityStoreContext.Provider
      value={{
        nekretnine: [],
        zakupnici: tenants,
        ugovori: [],
        dokumenti: [],
        loading: false,
        error: null,
        refresh: jest.fn(),
      }}
    >
      <ZakupniciView />
    </EntityStoreContext.Provider>,
  );
}

describe("Zakupnici search", () => {
  it("filters tenants based on search input", () => {
    renderZakupnici();

    // Both tenants should be visible initially
    expect(screen.getByText("Alpha d.o.o.")).toBeInTheDocument();
    expect(screen.getByText("Beta LLC")).toBeInTheDocument();

    const searchInput = screen.getByTestId("zakupnici-search-input");
    fireEvent.change(searchInput, { target: { value: "beta" } });

    expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    expect(screen.queryByText("Alpha d.o.o.")).not.toBeInTheDocument();
  });

  it("shows empty state when no results match", () => {
    renderZakupnici();

    const searchInput = screen.getByTestId("zakupnici-search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText("Nema rezultata")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pokušajte s drugim upitom ili dodajte novog zakupnika.",
      ),
    ).toBeInTheDocument();
  });
});
