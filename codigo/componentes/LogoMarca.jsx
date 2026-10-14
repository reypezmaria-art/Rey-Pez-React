/** Una misma imagen transparente para todos los puntos de identidad de la app. */
export default function LogoMarca({ variant = "header", official = false }) {
  return (
    <img
      className={`brand-logo brand-logo--${variant}`}
      src={
        official
          ? `${import.meta.env.BASE_URL}identidad/logo-oficial-rey-pez.jpeg`
          : `${import.meta.env.BASE_URL}identidad/logo-rey-pez.png`
      }
      alt="Rey Pez · El Cosas"
      width="1280"
      height="1280"
      decoding="async"
    />
  );
}
