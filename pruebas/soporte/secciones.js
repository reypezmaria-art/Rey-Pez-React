export async function abrirSeccion(page, grupo, titulo) {
  if (
    grupo === "Nómina" &&
    ["Cargar nómina", "Libros y exportación"].includes(titulo)
  )
    return;
  const menu = page.locator(`[data-secciones="${grupo}"]`);
  await menu.waitFor({ state: "attached" });
  if ((await menu.getAttribute("data-titulo-activo")) === titulo) return;
  const volver = menu.getByRole("button", {
    name: `← Volver a ${grupo}`,
    exact: true,
  });
  if (await volver.isVisible()) await volver.click();
  await menu.getByRole("button", { name: titulo, exact: true }).click();
}
