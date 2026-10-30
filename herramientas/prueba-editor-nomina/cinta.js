/* global document */
const rutas = {
  pegar: "M8 5H5v17h14V5h-3M9 2h6v5H9zM8 12h8M8 16h8",
  copiar: "M8 8h13v13H8zM4 16H2V2h14v2",
  fuente: "m4 20 7-17 7 17M7 14h8",
  alineacion: "M3 5h18M3 10h12M3 15h18M3 20h12",
  tabla: "M2 3h20v18H2zM2 9h20M2 15h20M9 3v18M15 3v18",
  insertar: "M2 3h20v18H2zM2 9h20M9 3v18M13 15h6M16 12v6",
  borrar: "m4 13 9-10 9 9-9 10H8zM8 18l9-10M12 22h10",
  buscar: "M16 16l6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  filtro: "M2 3h20l-8 9v8l-4 2V12z",
  ordenar: "M6 3v18m-4-4 4 4 4-4M14 4h8M14 10h6M14 16h4",
  pagina: "M5 2h10l5 5v15H5zM15 2v6h5M8 12h9M8 16h9",
  imprimir: "M6 8V2h12v6M6 18H2V8h20v10h-4M6 14h12v8H6z",
  revisar: "M5 2h14v20H5zM8 8l2 2 5-5M8 15h8M8 18h6",
  historial: "M3 3v6h6M3 9a9 9 0 1 1 0 7M12 7v6l4 2",
  vista: "M2 5h20v15H2zM2 10h20M8 5v15",
  ayuda:
    "M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 4M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
const nodo = (tag, texto, clase) => {
  const n = document.createElement(tag);
  if (texto !== undefined) n.textContent = texto;
  if (clase) n.className = clase;
  return n;
};
function icono(nombre) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", rutas[nombre] || rutas.tabla);
  svg.append(path);
  return svg;
}

export function crearCinta({
  api,
  ejecutar,
  aviso,
  listarVersiones,
  recuperar,
}) {
  const root = document.getElementById("cinta");
  const dialogo = document.getElementById("dialogo-cinta");
  const contenido = document.getElementById("contenido-dialogo");
  const acciones = [],
    tabs = [],
    controles = {};
  let pestana = "Inicio";
  const libro = () => api()?.getActiveWorkbook();
  const hoja = () => libro()?.getActiveSheet();
  const rango = () => {
    const r = libro()?.getActiveRange();
    if (!r) throw Error("Selecciona una celda o un rango en la hoja.");
    return r;
  };
  const mostrar = (nombre) => {
    pestana = nombre;
    for (const t of tabs) {
      const activa = t.nombre === nombre;
      t.button.setAttribute("aria-selected", activa);
      t.button.tabIndex = activa ? 0 : -1;
      t.panel.hidden = !activa;
    }
  };
  const abrir = (titulo) => {
    document.getElementById("titulo-dialogo").textContent = titulo;
    contenido.replaceChildren();
    if (!dialogo.open) dialogo.showModal();
    return contenido;
  };
  const cerrar = () => dialogo.close();
  document.getElementById("cerrar-dialogo").onclick = cerrar;
  function formulario(titulo, construir, aplicar, texto = "Aplicar") {
    const body = abrir(titulo),
      form = nodo("form");
    const estado = nodo("p", "", "error-dialogo");
    estado.setAttribute("role", "alert");
    construir(form);
    const pie = nodo("footer");
    const cancel = nodo("button", "Cancelar");
    cancel.type = "button";
    cancel.onclick = cerrar;
    const enviar = nodo("button", texto, "primario");
    enviar.type = "submit";
    pie.append(cancel, enviar);
    form.append(estado, pie);
    body.append(form);
    form.onsubmit = async (event) => {
      event.preventDefault();
      enviar.disabled = true;
      try {
        const cerrarDespues = await aplicar(new FormData(form));
        if (cerrarDespues !== false) cerrar();
        sincronizar();
      } catch (e) {
        estado.textContent = e.message;
      } finally {
        enviar.disabled = false;
      }
    };
    form.querySelector("input, select")?.focus();
  }
  function campo(form, label, name, value = "", opciones) {
    const wrap = nodo("div", undefined, "campo-cinta"),
      etiqueta = nodo("label", label);
    const input = nodo(opciones ? "select" : "input");
    input.name = name;
    input.id = `campo-${name}`;
    etiqueta.htmlFor = input.id;
    if (opciones)
      for (const [v, texto] of opciones) {
        const option = nodo("option", texto);
        option.value = v;
        input.append(option);
      }
    input.value = value;
    wrap.append(etiqueta, input);
    form.append(wrap);
    return input;
  }
  function grupo(panel, nombre) {
    const section = nodo("section", undefined, "grupo-cinta");
    section.setAttribute("aria-label", nombre);
    section.dataset.grupo = nombre;
    const body = nodo("div", undefined, "grupo-controles");
    section.append(body, nodo("div", nombre, "grupo-nombre"));
    panel.append(section);
    return body;
  }
  function boton(parent, nombre, dibujo, action, opciones = {}) {
    const button = nodo(
      "button",
      undefined,
      `herramienta ${opciones.grande ? "grande" : ""}`,
    );
    button.type = "button";
    button.title = opciones.tip || nombre;
    button.setAttribute("aria-label", nombre);
    if (opciones.letra) button.append(nodo("b", opciones.letra, "icono-letra"));
    else button.append(icono(dibujo));
    button.append(nodo("span", nombre));
    button.onclick = () =>
      ejecutar(async () => {
        await action();
        sincronizar();
      });
    parent.append(button);
    acciones.push({ nombre, pestana, button });
    return button;
  }
  function selector(parent, label, valores, action, value) {
    const select = nodo("select");
    select.setAttribute("aria-label", label);
    select.title = label;
    for (const [v, texto] of valores) {
      const option = nodo("option", texto);
      option.value = v;
      select.append(option);
    }
    if (value) select.value = value;
    select.onchange = () => ejecutar(() => action(select.value));
    parent.append(select);
    return select;
  }
  function textoDialogo(titulo, lineas) {
    const body = abrir(titulo);
    for (const l of lineas) body.append(nodo("p", l));
  }
  function ir(r) {
    r.activate();
    hoja().scrollToCell(r.getRow(), r.getColumn());
  }
  function irACelda() {
    formulario(
      "Ir a una celda o rango",
      (form) => campo(form, "Referencia", "ref", rango().getA1Notation()),
      (data) => {
        const ref = data.get("ref").trim().toUpperCase();
        if (!/^[A-Z]{1,3}[1-9]\d{0,5}(:[A-Z]{1,3}[1-9]\d{0,5})?$/.test(ref))
          throw Error("Escribe una referencia como A1 o A1:D10.");
        ir(hoja().getRange(ref));
      },
      "Ir",
    );
  }
  function buscar() {
    formulario(
      "Buscar en la hoja",
      (form) => campo(form, "Texto o número", "texto"),
      (data) => {
        const q = data.get("texto").trim().toLocaleLowerCase("es");
        if (!q) throw Error("Escribe qué deseas buscar.");
        const h = hoja(),
          s = h.getSheetId(),
          snap = libro().save(),
          matches = [];
        for (const [r, row] of Object.entries(snap.sheets[s].cellData))
          for (const [c, cell] of Object.entries(row)) {
            if (
              String(cell.v ?? "")
                .toLocaleLowerCase("es")
                .includes(q)
            )
              matches.push(h.getRange(+r, +c));
          }
        cerrar();
        const body = abrir("Resultados de búsqueda");
        body.append(
          nodo("p", `${matches.length} coincidencias. Se muestran hasta 100.`),
        );
        for (const r of matches.slice(0, 100)) {
          const b = nodo(
            "button",
            `${r.getA1Notation()}: ${String(r.getValue()).slice(0, 120)}`,
            "resultado-cinta",
          );
          b.type = "button";
          b.onclick = () => {
            cerrar();
            ir(r);
          };
          body.append(b);
        }
        return false;
      },
      "Buscar",
    );
  }
  function funcion(tipo = "SUM") {
    const destino = rango();
    formulario(
      "Insertar función",
      (form) => {
        form.append(
          nodo("p", `Resultado en ${destino.getA1Notation().split(":")[0]}.`),
        );
        campo(form, "Función", "funcion", tipo, [
          ["SUM", "SUMA"],
          ["AVERAGE", "PROMEDIO"],
          ["MIN", "MÍNIMO"],
          ["MAX", "MÁXIMO"],
          ["COUNT", "CONTAR"],
        ]);
        campo(
          form,
          "Rango de origen",
          "origen",
          destino.getRow() > 0 ? `A1:A${destino.getRow()}` : "A2:A5",
        );
      },
      (data) => {
        const ref = data.get("origen").trim().toUpperCase();
        if (!/^[A-Z]{1,3}[1-9]\d{0,5}:[A-Z]{1,3}[1-9]\d{0,5}$/.test(ref))
          throw Error("Escribe un rango como B2:B10.");
        const h = hoja(),
          origen = h.getRange(ref),
          r = destino.getRow(),
          c = destino.getColumn();
        if (
          r >= origen.getRow() &&
          r <= origen.getLastRow() &&
          c >= origen.getColumn() &&
          c <= origen.getLastColumn()
        )
          throw Error("El rango no puede incluir la celda del resultado.");
        h.getRange(r, c).setFormula(`=${data.get("funcion")}(${ref})`);
      },
    );
  }
  function ordenar(ascending) {
    const seleccion = rango();
    if (seleccion.getHeight() < 2)
      throw Error(
        "Selecciona las filas y todas las columnas que deben moverse juntas.",
      );
    formulario(
      "Ordenar selección",
      (form) => {
        form.append(
          nodo(
            "p",
            `Se ordenará ${seleccion.getA1Notation()}. Incluye todas las columnas relacionadas para mantener juntas las filas.`,
          ),
        );
        campo(
          form,
          "Columna dentro de la selección",
          "col",
          "0",
          Array.from({ length: seleccion.getWidth() }, (_, i) => [
            String(i),
            `Columna ${i + 1}`,
          ]),
        );
        campo(form, "Orden", "asc", String(ascending), [
          ["true", "A a Z / menor a mayor"],
          ["false", "Z a A / mayor a menor"],
        ]);
        campo(form, "Encabezados", "encabezado", "si", [
          ["si", "La primera fila contiene encabezados"],
          ["no", "Todas las filas contienen datos"],
        ]);
      },
      (data) => {
        const salto = data.get("encabezado") === "si" ? 1 : 0;
        if (seleccion.getHeight() - salto < 2)
          throw Error("Selecciona al menos dos filas de datos.");
        hoja()
          .getRange(
            seleccion.getRow() + salto,
            seleccion.getColumn(),
            seleccion.getHeight() - salto,
            seleccion.getWidth(),
          )
          .sort({
            column: +data.get("col"),
            ascending: data.get("asc") === "true",
          });
      },
      "Ordenar",
    );
  }
  async function historial() {
    const versiones = await listarVersiones(),
      body = abrir("Historial de versiones guardadas");
    body.append(
      nodo(
        "p",
        "Versiones guardadas en este navegador. Reabrir sustituye la vista actual; guarda antes si deseas conservarla.",
      ),
    );
    if (!versiones.length)
      body.append(nodo("p", "Todavía no hay versiones guardadas."));
    for (const v of versiones) {
      const b = nodo(
        "button",
        `${new Date(v.id).toLocaleString("es-MX")} · ${v.nombre}`,
        "resultado-cinta",
      );
      b.onclick = () =>
        ejecutar(async () => {
          await recuperar(v.id);
          cerrar();
        });
      body.append(b);
    }
  }
  function revisar() {
    const body = abrir("Revisión de fórmulas"),
      snap = libro().save(),
      data = snap.sheets[hoja().getSheetId()].cellData;
    let count = 0;
    body.append(
      nodo(
        "p",
        "Errores presentes en los resultados y vínculos externos que el editor no recalcula.",
      ),
    );
    for (const [r, row] of Object.entries(data))
      for (const [c, cell] of Object.entries(row)) {
        const error =
          /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(
            String(cell.v),
          );
        if (!error && !cell.custom?.formulaExterna) continue;
        count++;
        const range = hoja().getRange(+r, +c),
          b = nodo(
            "button",
            `${range.getA1Notation()}: ${error ? cell.v : "Vínculo externo sin recalcular"}`,
            "resultado-cinta",
          );
        b.onclick = () => {
          cerrar();
          ir(range);
        };
        body.append(b);
      }
    if (!count)
      body.append(
        nodo("p", "No se encontraron estos avisos en la hoja actual."),
      );
  }

  const tablist = nodo("div", undefined, "pestanas-cinta");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Pestañas de herramientas");
  root.append(tablist);
  const paneles = nodo("div", undefined, "paneles-cinta");
  root.append(paneles);
  const crearTab = (nombre, construir) => {
    pestana = nombre;
    const key = `cinta-${tabs.length}`,
      b = nodo("button", nombre),
      panel = nodo("div", undefined, "panel-cinta");
    b.type = "button";
    b.id = `${key}-tab`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", key);
    panel.id = key;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", b.id);
    b.onclick = () => mostrar(nombre);
    tablist.append(b);
    paneles.append(panel);
    tabs.push({ nombre, button: b, panel });
    construir(panel);
  };
  crearTab("Inicio", (p) => {
    const copy = grupo(p, "Portapapeles");
    boton(
      copy,
      "Pegar",
      "pegar",
      async () => {
        if (!(await api().paste()))
          throw Error(
            "Usa Ctrl+V sobre la hoja o permite el acceso al portapapeles.",
          );
      },
      { grande: true },
    );
    boton(copy, "Copiar", "copiar", async () => {
      if (!(await api().copy())) throw Error("Usa Ctrl+C sobre la selección.");
    });
    const font = grupo(p, "Fuente");
    controles.fuente = selector(
      font,
      "Fuente",
      ["Arial", "Calibri", "Aptos", "Times New Roman"].map((v) => [v, v]),
      (v) => rango().setFontFamily(v),
    );
    controles.tamano = selector(
      font,
      "Tamaño de fuente",
      [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36].map((n) => [
        String(n),
        String(n),
      ]),
      (v) => rango().setFontSize(+v),
      "11",
    );
    controles.negrita = boton(
      font,
      "Negrita",
      "fuente",
      () =>
        rango().setFontWeight(
          rango().getCellStyleData()?.bl ? "normal" : "bold",
        ),
      { letra: "N" },
    );
    controles.cursiva = boton(
      font,
      "Cursiva",
      "fuente",
      () =>
        rango().setFontStyle(
          rango().getCellStyleData()?.it ? "normal" : "italic",
        ),
      { letra: "K" },
    );
    controles.subrayado = boton(
      font,
      "Subrayado",
      "fuente",
      () =>
        rango().setFontLine(
          rango().getCellStyleData()?.ul?.s ? "none" : "underline",
        ),
      { letra: "S" },
    );
    boton(font, "Bordes", "tabla", () =>
      rango().setBorder(
        api().Enum.BorderType.ALL,
        api().Enum.BorderStyleTypes.THIN,
        "#52616f",
      ),
    );
    for (const [label, method, initial] of [
      ["Relleno", "setBackgroundColor", "#fff2cc"],
      ["Color de fuente", "setFontColor", "#173b60"],
    ]) {
      const labelEl = nodo("label", label, "color-cinta"),
        input = nodo("input");
      input.type = "color";
      input.value = initial;
      input.setAttribute("aria-label", label);
      input.onchange = () => ejecutar(() => rango()[method](input.value));
      labelEl.append(input);
      font.append(labelEl);
    }
    const align = grupo(p, "Alineación");
    for (const [label, value] of [
      ["Izquierda", "left"],
      ["Centrar", "center"],
      ["Derecha", "right"],
    ])
      boton(align, label, "alineacion", () =>
        rango().setHorizontalAlignment(value),
      );
    boton(align, "Ajustar texto", "alineacion", () =>
      rango().setWrap(!rango().getWrap()),
    );
    boton(align, "Combinar y centrar", "tabla", () => {
      if (rango().getHeight() * rango().getWidth() < 2)
        throw Error("Selecciona dos o más celdas.");
      if (
        rango()
          .getValues()
          .flat()
          .filter((v) => v !== null && v !== "").length > 1
      )
        throw Error(
          "La selección contiene varios valores. Muévelos antes de combinar para conservarlos.",
        );
      rango().merge().setHorizontalAlignment("center");
    });
    boton(align, "Separar celdas", "tabla", () => rango().breakApart());
    const number = grupo(p, "Número");
    controles.numero = selector(
      number,
      "Formato de número",
      [
        ["General", "General"],
        ["0.00", "Número"],
        ['"$"#,##0.00', "Moneda"],
        ["0.00%", "Porcentaje"],
        ["dd/mm/yyyy", "Fecha"],
        ["@", "Texto"],
      ],
      (v) => rango().setNumberFormat(v),
    );
    boton(
      number,
      "Moneda",
      "fuente",
      () => rango().setNumberFormat('"$"#,##0.00'),
      { letra: "$" },
    );
    boton(
      number,
      "Porcentaje",
      "fuente",
      () => rango().setNumberFormat("0.00%"),
      { letra: "%" },
    );
    const styles = grupo(p, "Estilos");
    boton(styles, "Encabezado", "tabla", () =>
      rango()
        .setBackgroundColor("#173b60")
        .setFontColor("#ffffff")
        .setFontWeight("bold"),
    );
    boton(styles, "Total", "tabla", () =>
      rango()
        .setBackgroundColor("#e5eff8")
        .setFontColor("#173b60")
        .setFontWeight("bold"),
    );
    const cells = grupo(p, "Celdas");
    boton(cells, "Insertar fila", "insertar", () =>
      hoja().insertRowsBefore(rango().getRow(), 1),
    );
    boton(cells, "Insertar columna", "insertar", () =>
      hoja().insertColumnsBefore(rango().getColumn(), 1),
    );
    const edit = grupo(p, "Edición");
    boton(edit, "Autosuma", "fuente", () => funcion(), { letra: "Σ" });
    boton(edit, "Buscar", "buscar", buscar);
    boton(edit, "Borrar contenido", "borrar", () => rango().clearContent());
  });
  crearTab("Insertar", (p) => {
    const cells = grupo(p, "Filas y columnas");
    boton(
      cells,
      "Insertar fila encima",
      "insertar",
      () => hoja().insertRowsBefore(rango().getRow(), 1),
      { grande: true },
    );
    boton(
      cells,
      "Insertar columna a la izquierda",
      "insertar",
      () => hoja().insertColumnsBefore(rango().getColumn(), 1),
      { grande: true },
    );
    const sheets = grupo(p, "Hojas");
    boton(
      sheets,
      "Nueva hoja",
      "pagina",
      () => libro().insertSheet().activate(),
      { grande: true },
    );
    boton(
      sheets,
      "Duplicar hoja",
      "copiar",
      () => libro().duplicateActiveSheet().activate(),
      { grande: true },
    );
    boton(
      grupo(p, "Funciones"),
      "Insertar función",
      "fuente",
      () => funcion(),
      { letra: "ƒx", grande: true },
    );
  });
  const impresion = {
    papel: "letter",
    orientacion: "portrait",
    margen: "12",
    seleccion: "no",
  };
  function configurarPagina() {
    formulario(
      "Configurar página",
      (form) => {
        campo(form, "Tamaño de papel", "papel", impresion.papel, [
          ["letter", "Carta"],
          ["A4", "A4"],
        ]);
        campo(form, "Orientación", "orientacion", impresion.orientacion, [
          ["portrait", "Vertical"],
          ["landscape", "Horizontal"],
        ]);
        campo(form, "Márgenes", "margen", impresion.margen, [
          ["12", "Normales (12 mm)"],
          ["6", "Estrechos (6 mm)"],
          ["20", "Amplios (20 mm)"],
        ]);
        campo(form, "Área de impresión", "seleccion", impresion.seleccion, [
          ["no", "Celdas con datos de la hoja actual"],
          ["si", "Selección actual"],
        ]);
      },
      (data) => {
        for (const k of Object.keys(impresion)) impresion[k] = data.get(k);
        aviso("Configuración de impresión aplicada para esta sesión.");
      },
    );
  }
  function vistaImpresion() {
    const h = hoja(),
      s = libro().save().sheets[h.getSheetId()],
      sel = rango().getRange();
    let bottom = 0,
      right = 0;
    for (const [r, row] of Object.entries(s.cellData))
      for (const [c, cell] of Object.entries(row))
        if (cell.v != null || cell.f) {
          bottom = Math.max(bottom, +r);
          right = Math.max(right, +c);
        }
    const area =
      impresion.seleccion === "si"
        ? sel
        : { startRow: 0, startColumn: 0, endRow: bottom, endColumn: right };
    if (
      (area.endRow - area.startRow + 1) *
        (area.endColumn - area.startColumn + 1) >
      5000
    )
      throw Error(
        "La vista simplificada admite hasta 5,000 celdas. Configura el área como selección y elige un rango menor.",
      );
    const wrapper = nodo("div");
    wrapper.append(nodo("h1", h.getSheetName()));
    const table = nodo("table");
    for (let r = area.startRow; r <= area.endRow; r++) {
      const tr = nodo("tr");
      for (let c = area.startColumn; c <= area.endColumn; c++) {
        const td = nodo("td", String(h.getRange(r, c).getValue() ?? ""));
        tr.append(td);
      }
      table.append(tr);
    }
    wrapper.append(table);
    const body = abrir("Vista de impresión simplificada");
    body.append(
      nodo(
        "p",
        "Vista de valores para imprimir. Los formatos avanzados y las combinaciones no se reproducen en esta vista.",
      ),
    );
    const frame = nodo("iframe");
    frame.title = "Vista previa de impresión";
    frame.className = "vista-impresion";
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>@page{size:${impresion.papel} ${impresion.orientacion};margin:${impresion.margen}mm}body{font:11px Arial;color:#172c47}h1{font-size:18px}table{border-collapse:collapse;width:100%}td{border:1px solid #8898a8;padding:5px;white-space:pre-wrap}tr{break-inside:avoid}</style></head><body>${wrapper.outerHTML}</body></html>`;
    body.append(frame);
    const print = nodo("button", "Imprimir / guardar PDF", "primario");
    print.disabled = true;
    frame.onload = () => {
      print.disabled = false;
    };
    print.onclick = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    body.append(print);
  }
  crearTab("Disposición de página", (p) => {
    const page = grupo(p, "Configurar página");
    boton(page, "Márgenes y orientación", "pagina", configurarPagina, {
      grande: true,
    });
    boton(page, "Área de impresión", "tabla", configurarPagina, {
      grande: true,
    });
    boton(
      grupo(p, "Imprimir"),
      "Vista de impresión",
      "imprimir",
      vistaImpresion,
      { grande: true },
    );
  });
  crearTab("Fórmulas", (p) => {
    const lib = grupo(p, "Biblioteca de funciones");
    for (const [id, label] of [
      ["SUM", "Autosuma"],
      ["AVERAGE", "Promedio"],
      ["MIN", "Mínimo"],
      ["MAX", "Máximo"],
      ["COUNT", "Contar"],
    ])
      boton(lib, label, "fuente", () => funcion(id), {
        letra: id === "SUM" ? "Σ" : "ƒx",
        grande: true,
      });
    boton(grupo(p, "Revisión"), "Revisar fórmulas", "revisar", revisar, {
      grande: true,
    });
  });
  crearTab("Datos", (p) => {
    const sort = grupo(p, "Ordenar y filtrar");
    boton(sort, "Ordenar A a Z", "ordenar", () => ordenar(true), {
      grande: true,
    });
    boton(sort, "Ordenar Z a A", "ordenar", () => ordenar(false), {
      grande: true,
    });
    boton(
      sort,
      "Filtro",
      "filtro",
      () => {
        if (hoja().getFilter()) {
          hoja().getFilter().remove();
          aviso("Filtro retirado.");
          return;
        }
        if (rango().getHeight() < 2)
          throw Error(
            "Selecciona los encabezados y al menos una fila de datos.",
          );
        if (!rango().createFilter())
          throw Error("No se pudo crear el filtro. Revisa la selección.");
        aviso("Filtro activado. Usa las flechas de los encabezados.");
      },
      { grande: true },
    );
    boton(grupo(p, "Buscar y seleccionar"), "Buscar", "buscar", buscar, {
      grande: true,
    });
    boton(grupo(p, "Navegación"), "Ir a una celda", "tabla", irACelda, {
      grande: true,
    });
  });
  crearTab("Revisar", (p) => {
    boton(grupo(p, "Revisión"), "Revisar fórmulas", "revisar", revisar, {
      grande: true,
    });
    boton(
      grupo(p, "Versiones"),
      "Historial de versiones",
      "historial",
      historial,
      { grande: true },
    );
  });
  crearTab("Vista", (p) => {
    const view = grupo(p, "Mostrar");
    boton(
      view,
      "Líneas de cuadrícula",
      "tabla",
      () => {
        const s = libro().save().sheets[hoja().getSheetId()];
        hoja().setHiddenGridlines(s.showGridlines !== 0);
      },
      { grande: true },
    );
    const freeze = grupo(p, "Inmovilizar");
    boton(
      freeze,
      "Inmovilizar fila superior",
      "vista",
      () => hoja().setFrozenRows(1),
      { grande: true },
    );
    boton(
      freeze,
      "Inmovilizar primera columna",
      "vista",
      () => hoja().setFrozenColumns(1),
      { grande: true },
    );
    boton(freeze, "Movilizar paneles", "vista", () => hoja().cancelFreeze(), {
      grande: true,
    });
    const zoom = grupo(p, "Zoom");
    selector(
      zoom,
      "Zoom",
      [
        ["0.75", "75 %"],
        ["1", "100 %"],
        ["1.25", "125 %"],
        ["1.5", "150 %"],
        ["2", "200 %"],
      ],
      (v) => hoja().zoom(+v),
      "1",
    );
  });
  crearTab("Ayuda", (p) => {
    boton(
      grupo(p, "Aprendizaje"),
      "Cómo trabajar",
      "ayuda",
      () =>
        textoDialogo("Cómo trabajar con la hoja", [
          "Archivo: abre una copia de Excel, guarda en este navegador, reabre una versión o descarga una copia.",
          "Inicio: cambia fuentes, alineación, números y estilos sobre la selección. Insertar agrega filas, columnas y hojas.",
          "Fórmulas: elige una función, indica el rango de origen y aplica en la celda seleccionada.",
          "Datos: selecciona todas las columnas relacionadas antes de ordenar. El filtro usa la primera fila como encabezado.",
          "Consulta Archivo → Compatibilidad para conocer las opciones de descarga y guardado de esta vista.",
          "No incluye macros, tablas dinámicas, gráficos avanzados ni conexiones con otros archivos. Todavía no guarda en Firebase.",
        ]),
      { grande: true },
    );
    boton(
      grupo(p, "Atajos"),
      "Atajos de teclado",
      "tabla",
      () =>
        textoDialogo("Atajos de teclado", [
          "Ctrl+S: guardar en este navegador.",
          "Ctrl+Z / Ctrl+Y: deshacer / rehacer.",
          "Ctrl+C / Ctrl+V: copiar / pegar en la hoja.",
          "Escape: cerrar el diálogo o el menú Archivo.",
        ]),
      { grande: true },
    );
  });
  tablist.onkeydown = (event) => {
    const index = tabs.findIndex((t) => t.button === document.activeElement);
    if (
      index < 0 ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    mostrar(tabs[target].nombre);
    tabs[target].button.focus();
  };
  const finder = nodo("div", undefined, "buscador-herramientas"),
    search = nodo("input"),
    results = nodo("div", undefined, "resultados-herramientas");
  search.placeholder = "Buscar una herramienta";
  search.setAttribute("aria-label", "Buscar una herramienta");
  results.hidden = true;
  finder.append(search, results);
  document
    .querySelector(".barra-titulo")
    .insertBefore(finder, document.getElementById("nombre-libro"));
  search.oninput = () => {
    results.replaceChildren();
    const q = search.value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    results.hidden = !q;
    if (!q) return;
    const matches = acciones
      .filter((a) =>
        a.nombre
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 8);
    for (const a of matches) {
      const b = nodo("button", `${a.nombre} · ${a.pestana}`);
      b.type = "button";
      b.onclick = () => {
        mostrar(a.pestana);
        results.hidden = true;
        a.button.focus();
        a.button.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      results.append(b);
    }
    if (!matches.length)
      results.append(nodo("p", "No hay herramientas con ese nombre."));
  };
  search.onkeydown = (event) => {
    if (event.key === "Escape") results.hidden = true;
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      results.querySelector("button")?.focus();
    }
  };
  finder.addEventListener("focusout", (event) => {
    if (!finder.contains(event.relatedTarget)) results.hidden = true;
  });
  function sincronizar() {
    if (!libro()?.getActiveRange()) return;
    const s = rango().getCellStyleData() || {};
    for (const [key, value] of [
      ["fuente", s.ff || "Arial"],
      ["tamano", String(s.fs || 11)],
      ["numero", rango().getNumberFormat() || "General"],
    ]) {
      if ([...controles[key].options].some((o) => o.value === value))
        controles[key].value = value;
    }
    controles.negrita.setAttribute("aria-pressed", !!s.bl);
    controles.cursiva.setAttribute("aria-pressed", !!s.it);
    controles.subrayado.setAttribute("aria-pressed", !!s.ul?.s);
  }
  mostrar("Inicio");
  return { sincronizar };
}
