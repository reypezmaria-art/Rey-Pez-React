import IconoBitacora from "../componentes/IconoBitacora.jsx";
import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { EncabezadoPagina } from "../componentes/ElementosInterfaz.jsx";
import { logTypes } from "../datos/operacionInicial.js";
import { canCapture } from "../dominio/seguridad.js";
import Bitacoras from "./Bitacoras.jsx";
const folderNames = {
  health: "Bitácoras de salud",
  epp: "Bitácora de EPP",
  labor: "Normas de la Secretaría del Trabajo",
};
function shortTitle(s) {
  if (s.type === "temperature") return "Temperaturas";
  if (s.type === "cleaning")
    return s.title.includes("embolsado")
      ? "Embolsado"
      : s.title.includes("despique")
        ? "Despique"
        : "Limpieza · cocción";
  if (s.type === "bathrooms")
    return s.id.endsWith("admin") ? "Baños oficina" : "Baños";
  if (s.type === "waste")
    return s.id.endsWith("despique") ? "Residuos · despique" : "Residuos";
  if (s.type === "health") return "Certificados";
  if (s.type === "fumigation") return "Fumigación";
  if (s.type === "epp")
    return s.id === "epp-rooms"
      ? "Cuartos fríos"
      : s.title.includes("carga")
        ? "Proceso"
        : s.title;
  return s.title;
}
function healthSections(company, areas) {
  const scoped = areas.filter(
    (a) => a.company === company && a.active !== false,
  );
  const match = (name) =>
    scoped.filter((a) => a.name === name).map((a) => a.id);
  const sections = [
    { id: "chlorine", type: "chlorine", title: "Cloro" },
    {
      id: "temperature",
      type: "temperature",
      title: "Temperaturas · cuartos fríos",
    },
    { id: "cooking", type: "cooking", title: "Cocción" },
  ];
  const cleaning = scoped.filter((a) =>
    ["Cocción", "Embolsado", "Despique"].includes(a.name),
  );
  if (cleaning.length)
    sections.push(
      ...cleaning.map((a) => ({
        id: `cleaning-${a.id}`,
        type: "cleaning",
        title:
          a.name === "Embolsado"
            ? "Limpieza y jabón · embolsado"
            : `Limpieza y desinfección · ${a.name.toLowerCase()}`,
        area: a.id,
      })),
    );
  else
    sections.push({
      id: "cleaning",
      type: "cleaning",
      title: "Limpieza y desinfección",
    });
  sections.push(
    {
      id: "bathrooms",
      type: "bathrooms",
      title: "Sanitarios generales",
      allowedAreaIds: match("Sanitarios"),
    },
    {
      id: "bathrooms-admin",
      type: "bathrooms",
      title: "Sanitarios administrativos",
      allowedAreaIds: match("Sanitarios administrativos"),
    },
    { id: "waste", type: "waste", title: "Separación y limpieza de residuos" },
  );
  if (company === "ESTUARDO")
    sections.push({
      id: "waste-despique",
      type: "waste",
      title: "Revisión de residuos · despique",
      area: match("Despique")[0],
    });
  sections.push(
    { id: "health", type: "health", title: "Certificados de salud" },
    {
      id: "fumigation",
      type: "fumigation",
      title: "Certificados de fumigación",
    },
  );
  return sections;
}
export default function CarpetasBitacoras({
  folder = "health",
  operational = false,
}) {
  const { data, session } = useAplicacion();
  const permission = data.access.permissions[session.id];
  const [company, setCompany] = useState(permission?.company || "ALLAN"),
    [selected, setSelected] = useState(null),
    [activeFolder, setActiveFolder] = useState(folder);
  const qrId = operational
    ? new URLSearchParams(location.hash.split("?")[1] || "").get("area")
    : null;
  const qr = data.areas.concat(data.rooms).find((a) => a.id === qrId);
  const selectedCompany =
    qr?.company || (session.role === "worker" ? permission?.company : company);
  const currentFolder = operational ? activeFolder : folder;
  const folders = Object.entries(folderNames).filter(
    ([key]) =>
      session.role === "admin" ||
      (key !== "labor" &&
        Object.keys(logTypes).some(
          (type) =>
            (key === "epp" ? type === "epp" : type !== "epp") &&
            canCapture(data, session, selectedCompany, type),
        )),
  );
  const eppAreas = data.areas.filter(
    (a) =>
      a.company === selectedCompany &&
      a.active !== false &&
      [
        "Proceso / carga y descarga",
        "Carga y descarga",
        "Oficina",
        "El Galileo",
        "María Guadalupe",
      ].includes(a.name),
  );
  const sections = (
    currentFolder === "health"
      ? healthSections(selectedCompany, data.areas)
      : eppAreas
          .map((a) => ({
            id: `epp-${a.id}`,
            type: "epp",
            title: a.name,
            area: a.id,
          }))
          .concat(
            selectedCompany !== "ESTUARDO"
              ? [
                  {
                    id: "epp-rooms",
                    type: "epp",
                    title: "Cuartos fríos · equipo de protección",
                    allowedAreaIds: data.rooms
                      .filter((r) => r.company === selectedCompany && r.active)
                      .map((r) => r.id),
                  },
                ]
              : [],
          )
  ).filter((s) => canCapture(data, session, selectedCompany, s.type));
  const current = sections.find((s) => s.id === selected);
  const allowedQr =
    qr &&
    sections.some((s) =>
      s.type === "temperature"
        ? data.rooms.some((r) => r.id === qr.id)
        : !s.area || s.area === qr.id,
    );
  return (
    <section>
      {(!current || operational) && (
        <EncabezadoPagina
          title={
            operational
              ? "Captura operativa autorizada"
              : folderNames[currentFolder]
          }
          subtitle="Carpetas separadas por empresa. Cada apartado conserva sus registros e historial."
        />
      )}
      <div className="toolbar">
        {session.role === "admin" && !qr && (
          <select
            aria-label="Empresa de carpeta"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setSelected(null);
            }}
          >
            {["ALLAN", "EDGAR", "ESTUARDO"].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        )}
        {session.role === "worker" && (
          <span className="pill">
            Empresa autorizada: {selectedCompany || "Pendiente"}
          </span>
        )}
      </div>
      {operational && (
        <div className="folder-tabs">
          {folders.map(([key, name]) => (
            <button
              key={key}
              className={currentFolder === key ? "primary" : ""}
              onClick={() => {
                setActiveFolder(key);
                setSelected(null);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {currentFolder === "labor" ? (
        <div className="panel">
          <h2>Carpeta de {selectedCompany}</h2>
          <p>Carpeta vacía, pendiente de definir sus normas y documentos.</p>
          <p className="small">
            Se conserva una carpeta independiente para cada empresa. No se
            agregan normas ni obligaciones sin definirlas contigo.
          </p>
        </div>
      ) : !sections.length || (qr && !allowedQr) ? (
        <div className="note">
          María debe autorizar las bitácoras de tu perfil para esta empresa.
        </div>
      ) : current ? (
        <>
          <div className="actions">
            <button onClick={() => setSelected(null)}>
              ← Volver a los apartados
            </button>
            <span className="pill">
              {folderNames[currentFolder]} · {selectedCompany}
            </span>
          </div>
          <Bitacoras
            key={`${current.id}-${selectedCompany}`}
            operational={operational}
            fixedType={current.type}
            fixedCompany={selectedCompany}
            fixedArea={current.area}
            allowedAreaIds={current.allowedAreaIds}
            sectionTitle={current.title}
          />
        </>
      ) : (
        <div className="folder-grid">
          {sections.map((s) => (
            <button
              className="folder-card"
              key={s.id}
              aria-label={s.title}
              title={s.title}
              onClick={() => setSelected(s.id)}
            >
              <IconoBitacora type={s.type} />
              <strong>{shortTitle(s)}</strong>
              <small>{selectedCompany} · Abrir apartado</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
