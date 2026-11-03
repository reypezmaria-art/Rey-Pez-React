export function PanelSeccion({ activa, children }) {
  return (
    <div className="section-content" hidden={!activa}>
      {children}
    </div>
  );
}
export default function SeccionesPagina({
  titulo,
  opciones,
  seleccion,
  onSeleccion,
  disabled = false,
}) {
  const actual = opciones.find((o) => o.id === seleccion);
  return (
    <div data-secciones={titulo} data-titulo-activo={actual?.titulo || ""}>
      {actual ? (
        <div className="actions">
          <button disabled={disabled} onClick={() => onSeleccion(null)}>
            ← Volver a {titulo}
          </button>
          <strong>{actual.titulo}</strong>
        </div>
      ) : (
        <div className="folder-grid" aria-label={`Secciones de ${titulo}`}>
          {opciones.map((o) => (
            <button
              className="folder-card"
              key={o.id}
              aria-label={o.titulo}
              disabled={disabled}
              onClick={() => onSeleccion(o.id)}
            >
              <span aria-hidden="true">{o.icono || "▤"}</span>
              <strong>{o.titulo}</strong>
              <small>{o.descripcion}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
