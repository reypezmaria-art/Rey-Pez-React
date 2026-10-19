import LogoMarca from "./LogoMarca.jsx";

/** Barra única: un logo, título de marca y, si hay sesión, identidad y salida. */
export default function Encabezado({
  titulo = "REY PEZ",
  detalle,
  identidad,
  onLogout,
}) {
  return (
    <header>
      <div className="brand-lockup">
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
