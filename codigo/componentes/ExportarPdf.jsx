import { useState } from "react";
import { Campo, Mensaje } from "./ElementosInterfaz.jsx";
import { localDate } from "../utilidades/fechas.js";
import { concordar } from "../utilidades/textos.js";
import { downloadReport } from "../utilidades/reportesPdf.js";
export default function ExportarPdf({ data, records, kind, title, company }) {
  const [from, setFrom] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(localDate);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function generate(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const count = await downloadReport({
        data,
        records,
        kind,
        title,
        company,
        from,
        to,
      });
      setMessage(
        `PDF generado: ${concordar(count, "registro", "registros")} del período seleccionado.`,
      );
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel" onSubmit={generate}>
      <h2>Reporte en PDF</h2>
      <p className="small">
        {title} · {company}. Las fechas incluyen ambos días.
      </p>
      <div className="toolbar">
        <Campo
          label="Desde"
          type="date"
          value={from}
          required
          onChange={(e) => setFrom(e.target.value)}
        />
        <Campo
          label="Hasta"
          type="date"
          value={to}
          required
          onChange={(e) => setTo(e.target.value)}
        />
        <button className="primary">Generar PDF</button>
      </div>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{message}</Mensaje>
    </form>
  );
}
