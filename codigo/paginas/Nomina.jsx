import EditorNomina from "../componentes/EditorNomina.jsx";
import {
  repositorioLibrosNomina,
  listarLibrosNomina,
} from "../repositorios/librosNomina.js";
import {
  empaquetarLibro,
  desempaquetarLibro,
} from "../utilidades/paqueteLibroNomina.js";
import { useState, useEffect } from "react";
import { procesarCarpetaNomina } from "../utilidades/carpetaNomina.js";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  EncabezadoPagina,
  Mensaje,
  OpcionesEmpresa,
  Tabla,
} from "../componentes/ElementosInterfaz.jsx";
import { nombresEmpresas } from "../dominio/empresas.js";
import {
  centavos,
  guardarNomina,
  modificarReciboNomina,
  recibosNomina,
} from "../dominio/nomina.js";
const pesos = (n) =>
  (n / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const etiqueta = (p) => `${p.empresa_nombre} · ${p.desde} al ${p.hasta}`;
export default function Nomina({ soloConsulta = false }) {
  const { data, persistirNomina, pending, clock, aviso, session } =
    useAplicacion();
  const responsable = session?.role === "worker" ? session.id : "MARIA";
  const [editor, setEditor] = useState(null);
  const [libros, setLibros] = useState([]);
  const [versionLibros, setVersionLibros] = useState(0);
  const [importacion, setImportacion] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const [resultadosCarpeta, setResultadosCarpeta] = useState([]);
  const [progresoCarpeta, setProgresoCarpeta] = useState(null);
  const [exportar, setExportar] = useState(""),
    [empresa, setEmpresa] = useState(""),
    [anio, setAnio] = useState(String(clock.getFullYear()));
  const [editar, setEditar] = useState(false),
    [modo, setModo] = useState("manual"),
    [periodoId, setPeriodoId] = useState(""),
    [trabajador, setTrabajador] = useState("");
  useEffect(() => {
    let activo = true;
    listarLibrosNomina()
      .then((lista) => {
        if (activo) setLibros(lista);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      });
    return () => {
      activo = false;
    };
  }, [versionLibros]);
  const periodos = [...(data.payroll || [])].sort(
    (a, b) =>
      b.desde.localeCompare(a.desde) ||
      a.empresa_nombre.localeCompare(b.empresa_nombre),
  );
  const periodo = periodos.find((p) => p.id === periodoId);
  const recibos = periodo ? recibosNomina(periodo) : [];
  const recibo = recibos.find((r) => r.clave === trabajador);
  const ocupado = busy || pending;
  async function subir(e, reemplazar = false) {
    const input = e.currentTarget,
      archivo = input.files?.[0];
    if (!archivo) return;
    setError("");
    setMensaje("");
    setBusy(true);
    try {
      const { leerPdfNomina } = await import("../utilidades/pdfNomina.js");
      const aliases = Object.fromEntries(
        Object.entries(nombresEmpresas(data)).map(([k, v]) => [k, [v]]),
      );
      const entrada = await leerPdfNomina(archivo, aliases);
      let huboCambio = false;
      await persistirNomina((state) => {
        const next = guardarNomina(state, entrada, { reemplazar, responsable });
        huboCambio = next !== state;
        return next;
      });
      setMensaje(
        huboCambio
          ? `${reemplazar ? "Nómina corregida" : "Nómina guardada"}: ${etiqueta(entrada)} · ${recibosNomina(entrada).length} trabajadores.`
          : "Este archivo ya estaba cargado. No se duplicó la nómina.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  async function subirCarpeta(e) {
    const input = e.currentTarget,
      archivos = Array.from(input.files || []);
    if (!archivos.length) return;
    setError("");
    setMensaje("");
    setResultadosCarpeta([]);
    setBusy(true);
    try {
      const { leerPdfNomina } = await import("../utilidades/pdfNomina.js");
      const aliases = Object.fromEntries(
        Object.entries(nombresEmpresas(data)).map(([k, v]) => [k, [v]]),
      );
      const { resultados, omitidos } = await procesarCarpetaNomina(archivos, {
        leer: (archivo) => leerPdfNomina(archivo, aliases),
        guardar: async (entrada) => {
          let cambio = false;
          await persistirNomina((state) => {
            const next = guardarNomina(state, entrada, { responsable });
            cambio = next !== state;
            return next;
          });
          return cambio;
        },
        alProgreso: setProgresoCarpeta,
      });
      setResultadosCarpeta(resultados);
      const contar = (estado) =>
        resultados.filter((r) => r.estado === estado).length;
      setMensaje(
        `Carpeta procesada: ${contar("Guardado")} guardados, ${contar("Ya cargado")} ya cargados y ${contar("No guardado")} no guardados. ${omitidos} archivos que no son PDF omitidos.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgresoCarpeta(null);
      input.value = "";
    }
  }
  async function abrirEditor() {
    if (!empresa || !anio) {
      setError("Selecciona la empresa y el año.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const ambito = { empresa, anio: Number(anio), tipo: exportar };
      const guardado = await repositorioLibrosNomina(ambito).abrir();
      let inicial;
      if (!guardado && !soloConsulta) {
        const { crearLibroNomina } =
          await import("../utilidades/excelNomina.js");
        inicial = {
          bytes: new Uint8Array(
            await crearLibroNomina(
              data,
              empresa,
              Number(anio),
              exportar,
            ).xlsx.writeBuffer(),
          ),
          nombre: `Nomina_${empresa}_${anio}_${exportar}.xlsx`,
        };
      }
      if (!guardado && soloConsulta)
        throw Error(
          "María debe guardar primero el libro de esta empresa y año.",
        );
      setEditor({ ambito, inicial });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function generar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setBusy(true);
    try {
      const repo = repositorioLibrosNomina({
        empresa,
        anio: Number(anio),
        tipo: exportar,
      });
      const guardado = await repo.abrir();
      if (guardado) {
        const { snapshot, nombre } = await desempaquetarLibro(guardado.carga);
        const { exportarCompleto } =
          await import("../../herramientas/prueba-editor-nomina/exportacionCompleta.js");
        const { prepararAcumulado } =
          await import("../../herramientas/prueba-editor-nomina/formatoVista.js");
        const bytes = await exportarCompleto(await prepararAcumulado(snapshot));
        const url = URL.createObjectURL(
          new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        const { descargarExcelNomina } =
          await import("../utilidades/excelNomina.js");
        await descargarExcelNomina(data, empresa, Number(anio), exportar);
      }
      setMensaje(
        `Excel ${exportar} generado: ${nombresEmpresas(data)[empresa]} · ${anio}.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function subirExcel(e) {
    const input = e.currentTarget,
      archivo = input.files?.[0];
    if (!archivo) return;
    setBusy(true);
    setError("");
    setMensaje("");
    try {
      const { extraerAcumuladoNomina } =
        await import("../utilidades/importarAcumuladoNomina.js");
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const fuente = await extraerAcumuladoNomina(bytes, nombresEmpresas(data));
      setImportacion({ fuente, bytes });
    } catch (err) {
      setError(err.message);
    } finally {
      input.value = "";
      setBusy(false);
    }
  }
  async function confirmarImportacion() {
    setBusy(true);
    setError("");
    setMensaje("");
    const completados = [];
    try {
      const { crearExcelAcumulado } =
        await import("../utilidades/importarAcumuladoNomina.js");
      const { importar } =
        await import("../../herramientas/prueba-editor-nomina/conversion.js");
      const { fuente, bytes } = importacion;
      const previo = await repositorioLibrosNomina({
        empresa: fuente.empresa,
        anio: fuente.anio,
        tipo: "mensual",
      }).abrir();
      let combinada = fuente;
      if (previo) {
        if (
          !window.confirm(
            "Ya hay un libro guardado. Se generará una nueva versión desde el archivo, conservando los periodos importados anteriormente. Los ajustes manuales del editor quedarán en el historial anterior. ¿Continuar?",
          )
        )
          return;
        const anterior = (await desempaquetarLibro(previo.carga)).fuente;
        if (anterior) {
          const key = (r) =>
            `${r.rfc || r.nss || r.nombre}|${r.mes}|${r.periodo.match(/\d+\s*-\s*\d+/)?.[0].replace(/\s/g, "") || r.periodo}`;
          const registros = new Map(anterior.registros.map((r) => [key(r), r]));
          fuente.registros.forEach((r) => registros.set(key(r), r));
          combinada = { ...fuente, registros: [...registros.values()] };
        }
      }
      for (const tipo of ["mensual", "anual"]) {
        const ambito = { empresa: fuente.empresa, anio: fuente.anio, tipo };
        const repo = repositorioLibrosNomina(ambito),
          actual = await repo.abrir();
        const nombre = `Nomina_${fuente.empresa}_${fuente.anio}_${tipo}.xlsx`;
        const organizado = await importar(
          await crearExcelAcumulado(combinada, tipo),
          nombre,
        );
        const carga = await empaquetarLibro({
          snapshot: organizado.snapshot,
          nombre,
          bytes,
          fuente: combinada,
        });
        await repo.guardar(carga, actual?.actual || 0);
        completados.push(tipo);
      }
      setEmpresa(fuente.empresa);
      setAnio(String(fuente.anio));
      setExportar("mensual");
      setImportacion(null);
      setVersionLibros((v) => v + 1);
      setMensaje(
        "Nómina importada y guardada en los libros mensual y anual. Ya puedes abrirlos y exportarlos.",
      );
    } catch (err) {
      setError(
        `${completados.length ? `Se guardó: ${completados.join(", ")}. ` : ""}${err.message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function guardarManual(cambios, motivo) {
    setError("");
    setMensaje("");
    try {
      await persistirNomina((state) =>
        modificarReciboNomina(
          state,
          periodoId,
          trabajador,
          cambios,
          motivo,
          new Date(),
          responsable,
        ),
      );
      setMensaje(
        "Corrección de nómina guardada. Los demás períodos se conservan.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section className="payroll-page">
      <EncabezadoPagina
        title="Nómina"
        subtitle="Carga, consulta y exportación por empresa"
      />
      <Mensaje>{aviso}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{mensaje}</Mensaje>
      {!soloConsulta && (
        <section
          className="panel"
          aria-label="Cargar nómina"
          aria-busy={ocupado}
        >
          <h2>Subir archivo de nómina</h2>
          <p>
            La empresa, el período y los trabajadores se identifican
            automáticamente.
          </p>
          <Campo
            label="Seleccionar Excel acumulado de nómina"
            type="file"
            accept=".xlsx"
            disabled={ocupado}
            onChange={subirExcel}
          />
          <Campo
            label="Seleccionar PDF de nómina"
            type="file"
            accept=".pdf,application/pdf"
            disabled={ocupado}
            onChange={(e) => subir(e)}
          />
          <Campo
            label="Seleccionar carpeta de nóminas"
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            disabled={ocupado}
            onChange={subirCarpeta}
          />
          <p className="small">
            Se revisan los PDF de la carpeta y sus subcarpetas, hasta 100 por
            carga. Los períodos ya cargados no se duplican; las correcciones se
            hacen en Modificar un mes.
          </p>
          {busy && (
            <p role="status">
              {progresoCarpeta
                ? `Procesando ${progresoCarpeta.actual} de ${progresoCarpeta.total}: ${progresoCarpeta.archivo}`
                : "Procesando nómina…"}
            </p>
          )}
        </section>
      )}
      {resultadosCarpeta.length > 0 && (
        <details className="panel payroll-folder-results" open>
          <summary>
            Resultado de la carpeta ({resultadosCarpeta.length} PDF)
          </summary>
          <Tabla
            headings={["Archivo", "Estado", "Empresa, período o motivo"]}
            count={resultadosCarpeta.length}
          >
            {resultadosCarpeta.map((r, i) => (
              <tr key={i}>
                <td>{r.archivo}</td>
                <td>{r.estado}</td>
                <td>{r.detalle}</td>
              </tr>
            ))}
          </Tabla>
        </details>
      )}
      {importacion && (
        <section className="panel" aria-label="Revisar importación de Excel">
          <h2>
            Archivo identificado:{" "}
            {nombresEmpresas(data)[importacion.fuente.empresa]} ·{" "}
            {importacion.fuente.anio}
          </h2>
          <p>
            {importacion.fuente.registros.length} registros con importes ·{" "}
            {new Set(importacion.fuente.registros.map((r) => r.mes)).size}{" "}
            meses.
          </p>
          <ul>
            {importacion.fuente.advertencias.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <button
            disabled={ocupado}
            className="primary"
            onClick={confirmarImportacion}
          >
            Guardar nómina identificada
          </button>
          <button disabled={ocupado} onClick={() => setImportacion(null)}>
            Cancelar
          </button>
        </section>
      )}
      <div className="payroll-actions">
        <button
          className="panel payroll-export"
          disabled={ocupado}
          onClick={() => setExportar("mensual")}
        >
          <strong>Generar mensual</strong>
          <span>Todos los meses cargados · una hoja por mes</span>
        </button>
        <button
          className="panel payroll-export"
          disabled={ocupado}
          onClick={() => setExportar("anual")}
        >
          <strong>Generar anual</strong>
          <span>Una hoja por trabajador · todos sus períodos</span>
        </button>
      </div>
      {exportar && (
        <section
          className="panel"
          aria-label="Opciones de exportación de nómina"
        >
          <div className="payroll-heading">
            <h2>Generar {exportar}</h2>
            <button
              onClick={() => setExportar("")}
              aria-label="Cerrar exportación de nómina"
            >
              Cerrar
            </button>
          </div>
          <form onSubmit={generar}>
            <div className="formgrid">
              <Campo
                label="Empresa para exportar nómina"
                as="select"
                required
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
              >
                <option value="">Selecciona una empresa…</option>
                <OpcionesEmpresa />
              </Campo>
              <Campo
                label="Año de nómina"
                type="number"
                min="2000"
                max="2100"
                required
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>
            <p>
              {exportar === "mensual"
                ? "Los meses cargados se ordenan consecutivamente, con todos los trabajadores de cada mes."
                : "Cada trabajador tiene su hoja con todas sus nóminas cargadas del año."}
            </p>
            <button type="button" disabled={ocupado} onClick={abrirEditor}>
              {soloConsulta ? "Ver libro guardado" : "Abrir editor de nómina"}
            </button>
            <button className="primary" disabled={ocupado}>
              Descargar Excel {exportar}
            </button>
          </form>
        </section>
      )}
      {!soloConsulta && (
        <div className="payroll-manage">
          <button onClick={() => setEditar(!editar)} aria-expanded={editar}>
            Modificar un mes
          </button>
        </div>
      )}
      {editar && !soloConsulta && (
        <section className="panel" aria-label="Modificar un mes">
          <h2>Modificar un mes</h2>
          <fieldset className="payroll-method">
            <legend>¿Cómo quieres modificarlo?</legend>
            <label>
              <input
                type="radio"
                name="modo-nomina"
                value="manual"
                checked={modo === "manual"}
                onChange={() => setModo("manual")}
              />{" "}
              Editar datos manualmente
            </label>
            <label>
              <input
                type="radio"
                name="modo-nomina"
                value="archivo"
                checked={modo === "archivo"}
                onChange={() => setModo("archivo")}
              />{" "}
              Volver a subir archivo
            </label>
          </fieldset>
          {modo === "archivo" ? (
            <div>
              <p>
                Sube el PDF corregido. Se detectarán automáticamente la empresa
                y el período cargado para actualizarlos.
              </p>
              <Campo
                label="Seleccionar PDF corregido"
                type="file"
                accept=".pdf,application/pdf"
                disabled={ocupado}
                onChange={(e) => subir(e, true)}
              />
            </div>
          ) : (
            <>
              <div className="formgrid">
                <Campo
                  label="Nómina a modificar"
                  as="select"
                  value={periodoId}
                  onChange={(e) => {
                    setPeriodoId(e.target.value);
                    setTrabajador("");
                  }}
                >
                  <option value="">Selecciona una nómina cargada…</option>
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {etiqueta(p)}
                    </option>
                  ))}
                </Campo>
                <Campo
                  label="Trabajador de la nómina"
                  as="select"
                  value={trabajador}
                  disabled={!periodo}
                  onChange={(e) => setTrabajador(e.target.value)}
                >
                  <option value="">Selecciona un trabajador…</option>
                  {recibos.map((r) => (
                    <option key={r.clave} value={r.clave}>
                      {r.nombre}
                    </option>
                  ))}
                </Campo>
              </div>
              {recibo && (
                <EditarRecibo
                  key={`${periodo.id}-${periodo.revision}-${recibo.clave}`}
                  recibo={recibo}
                  guardar={guardarManual}
                  disabled={ocupado}
                />
              )}
            </>
          )}
        </section>
      )}
      <details className="panel payroll-files">
        <summary>Archivos cargados ({periodos.length + libros.length})</summary>
        {libros.map((l) => (
          <p key={`${l.empresa}-${l.anio}-${l.tipo}`}>
            <strong>
              {nombresEmpresas(data)[l.empresa]} · {l.anio} · {l.tipo}
            </strong>{" "}
            · Versión {l.revision}{" "}
            <button
              onClick={() =>
                setEditor({
                  ambito: { empresa: l.empresa, anio: l.anio, tipo: l.tipo },
                })
              }
            >
              {soloConsulta ? "Ver libro" : "Abrir libro"}
            </button>
          </p>
        ))}
        {!periodos.length && !libros.length ? (
          <p>Aún no hay nóminas cargadas.</p>
        ) : (
          periodos.map((p) => (
            <details key={p.id} className="payroll-file">
              <summary>{etiqueta(p)}</summary>
              <p>
                {p.archivo} · Revisión {p.revision} · {recibosNomina(p).length}{" "}
                trabajadores
              </p>
              <DesgloseNomina periodo={p} />
            </details>
          ))
        )}
      </details>
      {editor && (
        <EditorNomina
          {...editor}
          soloConsulta={soloConsulta}
          onClose={() => {
            setEditor(null);
            setVersionLibros((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
function DesgloseNomina({ periodo }) {
  const registros = recibosNomina(periodo);
  return (
    <>
      <Tabla
        headings={[
          "Trabajador",
          "Salario diario",
          "Percepciones",
          "Deducciones",
          "Neto a pagar",
        ]}
        count={registros.length}
      >
        {registros.map((r) => (
          <tr key={r.clave}>
            <td>{r.nombre}</td>
            <td>{pesos(r.salarioDiario)}</td>
            <td>{pesos(r.totalPercepciones)}</td>
            <td>{pesos(r.totalDeducciones)}</td>
            <td>{pesos(r.neto)}</td>
          </tr>
        ))}
      </Tabla>
      {registros.map((r) => (
        <details className="payroll-receipt" key={r.clave}>
          <summary>Desglose · {r.nombre}</summary>
          <Tabla
            headings={["Tipo", "Código", "Concepto", "Importe", "Aplicación"]}
            count={r.percepciones.length + r.deducciones.length}
          >
            {["percepciones", "deducciones"].flatMap((campo) =>
              r[campo].map((c) => (
                <tr key={`${campo}-${c.codigo}`}>
                  <td>
                    {campo === "percepciones" ? "Percepción" : "Deducción"}
                  </td>
                  <td>{c.codigo}</td>
                  <td>{c.concepto}</td>
                  <td>{pesos(c.importe)}</td>
                  <td>
                    {c.informativo
                      ? "Informativo; no suma al descuento"
                      : "Aplicado"}
                  </td>
                </tr>
              )),
            )}
          </Tabla>
        </details>
      ))}
    </>
  );
}
function EditarRecibo({ recibo, guardar, disabled }) {
  const [form, setForm] = useState(() => ({
    ...structuredClone(recibo),
    salarioDiario: (recibo.salarioDiario / 100).toFixed(2),
    percepciones: recibo.percepciones.map((c) => ({
      ...c,
      importe: (c.importe / 100).toFixed(2),
    })),
    deducciones: recibo.deducciones.map((c) => ({
      ...c,
      importe: (c.importe / 100).toFixed(2),
    })),
  }));
  const [motivo, setMotivo] = useState(""),
    [error, setError] = useState("");
  const campo = (clave) => ({
    value: form[clave],
    onChange: (e) => setForm({ ...form, [clave]: e.target.value }),
  });
  async function enviar(e) {
    e.preventDefault();
    setError("");
    try {
      const cambios = {
        ...form,
        salarioDiario: centavos(form.salarioDiario),
        diasPagados: Number(form.diasPagados),
      };
      for (const lista of ["percepciones", "deducciones"])
        cambios[lista] = form[lista].map((c) => ({
          ...c,
          importe: centavos(c.importe),
        }));
      await guardar(cambios, motivo);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form onSubmit={enviar}>
      <Mensaje error>{error}</Mensaje>
      <div className="formgrid">
        <Campo
          label="Salario diario"
          type="number"
          step="0.01"
          min="0"
          required
          {...campo("salarioDiario")}
        />
        <Campo
          label="Días pagados"
          type="number"
          step="0.01"
          min="0"
          max="31"
          required
          {...campo("diasPagados")}
        />
        {["percepciones", "deducciones"].flatMap((lista) =>
          form[lista].map((c, i) => (
            <Campo
              key={`${lista}-${c.codigo}`}
              label={`${lista === "percepciones" ? "Percepción" : "Deducción"} ${c.codigo}: ${c.concepto}${c.informativo ? " (informativo)" : ""}`}
              type="number"
              step="0.01"
              required
              value={c.importe}
              onChange={(e) =>
                setForm({
                  ...form,
                  [lista]: form[lista].map((actual, j) =>
                    j === i ? { ...actual, importe: e.target.value } : actual,
                  ),
                })
              }
            />
          )),
        )}
        <Campo
          label="Motivo de la corrección de nómina"
          required
          minLength={3}
          maxLength={500}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <p>
        Se conservan el recibo anterior y los demás períodos. Los totales se
        calculan con los conceptos aplicados.
      </p>
      <button className="primary" disabled={disabled}>
        Guardar corrección de nómina
      </button>
    </form>
  );
}
