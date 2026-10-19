export function concordar(cantidad, singular, plural) {
  const numero = Number(cantidad) || 0;
  return `${numero} ${numero === 1 ? singular : plural}`;
}
