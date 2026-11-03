import LogoMarca from "./LogoMarca.jsx";

/** Barra única: un logo, título de marca y, si hay sesión, identidad y salida. */
export default function Encabezado({
  titulo = "REY PEZ",
  detalle,
  identidad,
  onLogout,
  menuAbierto,
  onToggleMenu,
}) {
  return (
    <header>
      <div className="brand-lockup">
        {onToggleMenu && (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleMenu}
            aria-label={
              menuAbierto ? "Ocultar barra lateral" : "Mostrar barra lateral"
            }
            title={
              menuAbierto ? "Ocultar barra lateral" : "Mostrar barra lateral"
            }
            aria-expanded={menuAbierto}
            aria-controls="navegacion-principal"
          >
            ☰
          </button>
        )}
        <LogoMarca />
        <div className="brand">
          <span className="brand-title">{titulo}</span>
          {detalle ? <small>{detalle}</small> : null}
        </div>
      </div>
      {identidad || onLogout ? (
        <div className="header-access">
          {identidad ? (
            <span className="header-identity">{identidad}</span>
          ) : null}
          {onLogout ? (
            <button type="button" onClick={onLogout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
