export const logTypes = {
  temperature: "Temperaturas",
  chlorine: "Cloro",
  cleaning: "Limpieza y desinfección",
  bathrooms: "Sanitarios",
  waste: "Residuos",
  cooking: "Cocción",
  health: "Certificados de salud",
  fumigation: "Fumigación",
  epp: "Equipo de protección",
};
export const initialRooms = [
  { id: "EDGAR-1", company: "EDGAR", name: "Cuarto 1", active: true },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `ALLAN-${i + 1}`,
    company: "ALLAN",
    name: `Cuarto ${i + 1}`,
    active: true,
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `ESTUARDO-${i + 1}`,
    company: "ESTUARDO",
    name: `Cuarto ${i + 1}`,
    active: true,
  })),
];
export const initialAreas = [
  ...["ALLAN", "ESTUARDO"].flatMap((company) =>
    ["Cocción", "Sanitarios"].map((name) => ({
      id: `${company}-${name}`,
      company,
      name,
    })),
  ),
  { id: "ALLAN-Embolsado", company: "ALLAN", name: "Embolsado" },
  { id: "ESTUARDO-Despique", company: "ESTUARDO", name: "Despique" },
  ...["Carga y descarga", "El Galileo", "María Guadalupe"].map((name) => ({
    id: `EDGAR-${name}`,
    company: "EDGAR",
    name,
  })),
];
// Áreas confirmadas para los apartados separados de salud y EPP.
initialAreas.push(
  ...["ALLAN", "ESTUARDO"].flatMap((company) => [
    { id: `${company}-Proceso`, company, name: "Proceso / carga y descarga" },
    { id: `${company}-Oficina`, company, name: "Oficina" },
    {
      id: `${company}-SanitariosAdministrativos`,
      company,
      name: "Sanitarios administrativos",
    },
  ]),
  { id: "EDGAR-Oficina", company: "EDGAR", name: "Oficina" },
);
export const initialPrograms = [
  ...initialRooms.map((room) => ({
    id: `temp-${room.id}`,
    company: room.company,
    area: room.id,
    type: "temperature",
    days: [1, 2, 3, 4, 5, 6],
    times: ["09:00", "13:00", "17:00"],
    active: true,
  })),
  ...["ALLAN", "ESTUARDO"].flatMap((company) =>
    ["chlorine", "cleaning"].map((type) => ({
      id: `${type}-${company}`,
      company,
      area: `${company}-${type === "chlorine" ? "Proceso" : "Cocción"}`,
      type,
      days: [1],
      times: ["09:00", "17:00"],
      active: true,
    })),
  ),
];
export const baseOperation = {
  logs: [],
  maintenance: [],
  rooms: initialRooms,
  areas: initialAreas,
  programs: initialPrograms,
  access: { admin: null, workers: {}, permissions: {} },
  terminals: [],
  holidays: [],
  absenceReviews: [],
  scheduleExceptions: [],
  audit: [],
  securityAlerts: [],
};
