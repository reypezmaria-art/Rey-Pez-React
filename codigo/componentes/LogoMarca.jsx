/** Una misma imagen transparente para todos los puntos de identidad de la app. */
export default function LogoMarca({ variant = "header" }) {
  const base = import.meta.env.BASE_URL;
  return (
    <picture className="brand-logo-frame">
      <source type="image/webp" srcSet={`${base}identidad/logo-rey-pez.webp`} />
      <img
        className={`brand-logo brand-logo--${variant}`}
        src={`${base}identidad/logo-rey-pez.png`}
        alt="Rey Pez · El Cosas"
        width="640"
        height="640"
        decoding="async"
      />
    </picture>
  );
}
