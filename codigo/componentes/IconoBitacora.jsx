export default function IconoBitacora({ type }) {
  const paths = {
    chlorine: (
      <>
        <path d="M12 2 5 13a7 7 0 0 0 14 0Z" />
        <path d="M8 14a4 4 0 0 0 4 4" />
      </>
    ),
    temperature: (
      <>
        <path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z" />
        <path d="M12 8v10" />
      </>
    ),
    cooking: (
      <path d="M12 2c2 5-4 5-2 9 2-1 4-3 4-5 5 5 7 14-2 16C3 20 3 13 7 9c-1 4 0 5 2 6" />
    ),
    cleaning: (
      <>
        <path d="m16 2-6 10M6 10l8 5-5 7-8-5Z" />
        <path d="m3 18 4-5m0 7 4-5" />
      </>
    ),
    bathrooms: (
      <>
        <path d="M5 3h8v7H5ZM4 13h15v3a6 6 0 0 1-12 0v-3m8 9H8m9-9V9h4v4" />
      </>
    ),
    waste: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 16h12l1-16M10 10v8m4-8v8" />
      </>
    ),
    health: (
      <>
        <path d="M8 2h8v4H8ZM5 4H3v18h18V4h-2M12 10v8m-4-4h8" />
      </>
    ),
    fumigation: (
      <>
        <path d="M7 3h10v5H7ZM5 8h14v14H5Zm3 0V5m4 7v6m-3-3h6M17 5h5" />
      </>
    ),
    epp: (
      <>
        <path d="M4 17v-5a8 8 0 0 1 16 0v5M2 17h20v4H2ZM10 4v8m4-8v8" />
      </>
    ),
  };
  return (
    <svg
      className="log-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] || paths.health}
    </svg>
  );
}
