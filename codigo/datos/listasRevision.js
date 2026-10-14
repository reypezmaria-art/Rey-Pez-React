const makeItems = (labels) =>
  labels.map((label, index) => ({ id: `item-${index + 1}`, label }));
const process = makeItems([
  "Faja ajustable industrial",
  "Botas de plástico antiderrapantes",
  "Guantes de carcasa",
  "Cofia de polipropileno",
]);
const office = makeItems(["Zapato antiderrapante"]);
const cold = makeItems([
  "Chamarra térmica",
  "Botas de plástico antiderrapantes",
  "Guantes térmicos de piel",
  "Gorro o pasamontañas",
]);
const surfaces = makeItems(["Mesas", "Piso", "Taras", "Tinas", "Paredes"]);
const cookingCleaning = makeItems([
  "Limpieza de tina con agua, cloro y jabón",
  "Limpieza de canasto con agua, cloro y jabón",
  "Limpieza de taras con agua, cloro y jabón",
  "Limpieza de tinas con agua, cloro y jabón",
  "Limpieza de coladores con agua, cloro y jabón",
  "Limpieza de pisos y paredes con agua, cloro y jabón",
]);
const cooking = [
  { id: "tanque", label: "Revisión de fugas en tanque de gas" },
  { id: "linea", label: "Revisión de línea de gas" },
  ...cookingCleaning,
];
const bathrooms = makeItems([
  "Jabón para manos",
  "Papel para manos",
  "Papel de baño",
  "Basura",
  "Pisos limpios",
  "Paredes limpias",
  "Inodoros limpios",
  "Lavabos limpios",
]);
const waste = makeItems([
  "Separación de basura orgánica",
  "Separación de basura inorgánica",
  "Limpieza del área de tanques de basura",
  "El camión se llevó la basura",
  "Lavado y desinfección de tanques de basura",
]);
const despiqueWaste = makeItems([
  "Los contenedores se encuentran en buen estado",
  "La basura inorgánica está separada correctamente",
  "La basura orgánica está separada correctamente",
  "Se tira correctamente la basura en sus contenedores",
  "El área de los contenedores se encuentra limpia",
  "Se recolecta la basura en tiempo y forma",
]);
export function checklistFor(state, type, areaId) {
  const area = state.areas.concat(state.rooms).find((a) => a.id === areaId);
  if (!area) return null;
  if (type === "epp") {
    if (state.rooms.some((r) => r.id === areaId))
      return {
        id: "epp-cold-v1",
        items: cold,
        source: "Lista de EPP confirmada por María",
      };
    if (area.name === "Oficina")
      return {
        id: "epp-office-v1",
        items: office,
        source: "Lista de EPP confirmada por María",
      };
    if (["Proceso / carga y descarga", "Carga y descarga"].includes(area.name))
      return {
        id: "epp-process-v1",
        items: process,
        source: "Lista de EPP confirmada por María",
      };
    return {
      id: "epp-pending",
      items: [],
      pending:
        "Falta cotejar la lista de equipo del formato original de esta embarcación.",
    };
  }
  if (type === "cleaning") {
    if (area.name === "Cocción")
      return {
        id: "cleaning-cooking-v1",
        items: cookingCleaning,
        source: "PDF de Salud · páginas 7 y 13",
      };
    if (["Embolsado", "Despique"].includes(area.name))
      return {
        id: "cleaning-surfaces-v1",
        items: surfaces,
        source: "PDF de Salud · páginas 1 y 5",
      };
    return {
      id: "cleaning-pending",
      items: [],
      pending: "Falta el formato original de limpieza para esta área.",
    };
  }
  if (type === "cooking")
    return {
      id: "cooking-v1",
      items: cooking,
      source: "PDF de Salud · páginas 7 y 13",
    };
  if (type === "bathrooms")
    return {
      id: "bathrooms-v1",
      items: bathrooms,
      source: "PDF de Salud · páginas 2, 6 y 10",
    };
  if (type === "waste")
    return {
      id: area.name === "Despique" ? "waste-despique-v1" : "waste-v1",
      items: area.name === "Despique" ? despiqueWaste : waste,
      source:
        area.name === "Despique"
          ? "PDF de Salud · página 9"
          : "PDF de Salud · página 8",
    };
  return null;
}
export function logAreas(state, type, company) {
  const areas = (
    type === "temperature"
      ? state.rooms
      : type === "epp"
        ? state.areas.concat(state.rooms)
        : state.areas
  ).filter((a) => a.company === company && a.active !== false);
  if (type === "chlorine")
    return areas.filter((a) =>
      [
        "Embolsado",
        "Descarga",
        "Proceso / carga y descarga",
        "Carga y descarga",
      ].includes(a.name),
    );
  if (type === "cooking") return areas.filter((a) => a.name === "Cocción");
  if (type === "cleaning")
    return areas.filter((a) =>
      ["Cocción", "Embolsado", "Despique"].includes(a.name),
    );
  if (type === "bathrooms")
    return areas.filter((a) =>
      ["Sanitarios", "Sanitarios administrativos"].includes(a.name),
    );
  return areas;
}
export function areaLabel(area, type) {
  return type === "chlorine" &&
    ["Proceso / carga y descarga", "Carga y descarga"].includes(area.name)
    ? "Descarga"
    : area.name;
}
export function validateChecklist(template, answers) {
  if (template.pending) throw Error(template.pending);
  if (!Array.isArray(answers) || answers.length !== template.items.length)
    throw Error("Revisa todos los elementos de la lista fija.");
  const clean = template.items.map((item) => {
    const matches = answers.filter((a) => a.id === item.id);
    if (matches.length !== 1 || !["yes", "no"].includes(matches[0].status))
      throw Error(`Selecciona Cumplió o No cumplió para ${item.label}.`);
    const answer = matches[0];
    if (answer.status === "no" && !answer.reason?.trim())
      throw Error(`Indica por qué no cumplió: ${item.label}.`);
    return {
      ...item,
      status: answer.status,
      reason: answer.status === "no" ? answer.reason.trim() : "",
    };
  });
  return clean;
}
