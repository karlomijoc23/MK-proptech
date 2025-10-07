export const DOCUMENT_TYPE_LABELS = {
  ugovor: "Ugovor",
  racun: "Račun",
  procjena_vrijednosti: "Procjena vrijednosti",
  lokacijska_informacija: "Lokacijska informacija",
  aneks: "Aneks ugovora",
  zemljisnoknjizni_izvadak: "Zemljišnoknjižni izvadak",
  uporabna_dozvola: "Uporabna dozvola",
  gradevinska_dozvola: "Građevinska dozvola",
  energetski_certifikat: "Energetski certifikat",
  osiguranje: "Osiguranje",
  izvadak_iz_registra: "Izvadak iz registra",
  bon_2: "BON-2",
  certifikat: "Certifikat",
  ostalo: "Ostalo",
};

export const PROPERTY_DOCUMENT_TYPES = new Set([
  "procjena_vrijednosti",
  "lokacijska_informacija",
  "zemljisnoknjizni_izvadak",
  "uporabna_dozvola",
  "gradevinska_dozvola",
  "energetski_certifikat",
  "izvadak_iz_registra",
  "certifikat",
  "osiguranje",
]);

export const CONTRACT_DOCUMENT_TYPES = new Set([
  "ugovor",
  "aneks",
  "racun",
  "bon_2",
]);

export const DOCUMENT_TYPE_ALIASES = {
  ugovor_o_zakupu: "ugovor",
  lease_agreement: "ugovor",
  contract: "ugovor",
  aneks_ugovora: "aneks",
  annex: "aneks",
  invoice: "racun",
  bill: "racun",
  building_permit: "gradevinska_dozvola",
  construction_permit: "gradevinska_dozvola",
  usage_permit: "uporabna_dozvola",
  location_information: "lokacijska_informacija",
  location_permit: "lokacijska_informacija",
  property_valuation: "procjena_vrijednosti",
  valuation: "procjena_vrijednosti",
  energy_certificate: "energetski_certifikat",
  land_registry_extract: "zemljisnoknjizni_izvadak",
  register_extract: "izvadak_iz_registra",
  insurance_policy: "osiguranje",
  certificate: "certifikat",
};

export const normaliseDocumentTypeKey = (value) => {
  if (!value) {
    return "";
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
};

export const resolveDocumentType = (value) => {
  const key = normaliseDocumentTypeKey(value);
  if (!key) {
    return "ugovor";
  }
  if (DOCUMENT_TYPE_ALIASES[key]) {
    return DOCUMENT_TYPE_ALIASES[key];
  }
  if (
    PROPERTY_DOCUMENT_TYPES.has(key) ||
    CONTRACT_DOCUMENT_TYPES.has(key) ||
    key === "certifikat" ||
    key === "ostalo"
  ) {
    return key;
  }
  return "ostalo";
};

export const formatDocumentType = (tip) => DOCUMENT_TYPE_LABELS[tip] || tip;
