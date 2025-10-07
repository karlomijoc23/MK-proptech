export const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalised = value.replace(/[^0-9,.-]/g, "").replace(/,/g, "");
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const formatCurrency = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return "—";
  }
  return `${numeric.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
};

export const formatArea = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return "—";
  }
  return `${numeric.toLocaleString("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} m²`;
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(1)} %`;
};

export const formatDeltaPercentage = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const rounded = value.toFixed(1);
  const sign = value > 0 ? "+" : "";
  return `${sign}${rounded} %`;
};

export const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("hr-HR");
};

export const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("hr-HR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatBooleanish = (value) => {
  if (value === true || value === "DA") {
    return "Da";
  }
  if (value === false || value === "NE") {
    return "Ne";
  }
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return value;
};

export const formatPropertyType = (value) => {
  if (!value) {
    return "Nepoznata vrsta";
  }
  const map = {
    poslovna_zgrada: "Poslovna zgrada",
    stan: "Stan",
    zemljiste: "Zemljište",
    ostalo: "Ostalo",
  };
  return map[value] || value;
};
