// 2027 Fee Fixing Resolution (New Juaben Municipal) — temporal-structure rates.
// SUGGESTIONS ONLY: the register auto-fills the Fee when staff pick the structure
// and the field is still empty; staff can always type an exact amount where the
// office decides otherwise (the resolution values never lock the register).
export const STRUCTURE_FEE_2027: Record<string, number> = {
  "Wooden": 60.68,                                  // Wooden Kiosks/Sheds
  "Small": 120,                                     // Containers/Sealed Metal
  "Medium": 120,
  "Large": 120,
  "Double Container": 120,
};
export function structureFee2027(size: string): number | null {
  const f = STRUCTURE_FEE_2027[size];
  return typeof f === "number" ? f : null;
}
