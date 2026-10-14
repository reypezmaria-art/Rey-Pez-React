import { Campo } from "./ElementosInterfaz.jsx";
export default function ListaCumplimiento({ template, answers, onChange }) {
  if (template.pending) return <div className="note">{template.pending}</div>;
  function update(id, patch) {
    const current = answers.find((a) => a.id === id) || {
      id,
      status: "",
      reason: "",
    };
    onChange([...answers.filter((a) => a.id !== id), { ...current, ...patch }]);
  }
  return (
    <fieldset className="compliance-list span2">
      <legend>Elementos fijos de revisión</legend>
      {template.items.map((item) => {
        const answer = answers.find((a) => a.id === item.id) || {
          status: "",
          reason: "",
        };
        return (
          <div className="compliance-item" key={item.id}>
            <strong>{item.label}</strong>
            <div className="compliance-options">
              <label>
                <input
                  type="radio"
                  name={`check-${template.id}-${item.id}`}
                  aria-label={`${item.label}: Cumplió`}
                  value="yes"
                  checked={answer.status === "yes"}
                  onChange={() =>
                    update(item.id, { status: "yes", reason: "" })
                  }
                  required
                />
                Cumplió
              </label>
              <label>
                <input
                  type="radio"
                  name={`check-${template.id}-${item.id}`}
                  aria-label={`${item.label}: No cumplió`}
                  value="no"
                  checked={answer.status === "no"}
                  onChange={() => update(item.id, { status: "no" })}
                  required
                />
                No cumplió
              </label>
            </div>
            {answer.status === "no" && (
              <Campo
                label={`Por qué no cumplió: ${item.label}`}
                value={answer.reason}
                onChange={(e) => update(item.id, { reason: e.target.value })}
                required
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
