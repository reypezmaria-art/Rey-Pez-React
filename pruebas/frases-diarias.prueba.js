import { test } from "node:test";
import assert from "node:assert/strict";
import { fraseDelDia } from "../codigo/datos/frasesDiarias.js";
test("la frase permanece durante el día de México y cambia al llegar la medianoche", () => {
  assert.deepEqual(
    fraseDelDia(new Date("2026-10-19T06:00:00Z")),
    fraseDelDia(new Date("2026-10-20T05:59:59Z")),
  );
  assert.notDeepEqual(
    fraseDelDia(new Date("2026-10-20T05:59:59Z")),
    fraseDelDia(new Date("2026-10-20T06:00:00Z")),
  );
});
