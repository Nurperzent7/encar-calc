/** Утильсбор по объёму двигателя (л) */
export function getUtilFee(engineLiters: number): number {
  if (engineLiters <= 1) return 290_000
  if (engineLiters <= 2) return 757_000
  if (engineLiters < 3) return 1_081_000
  return 2_486_000
}

/** Первичная регистрация по году выпуска авто */
export function getPrimaryRegFee(carYear: number): number {
  if (carYear >= 2025) return 1_000
  if (carYear === 2024) return 216_000
  return 2_162_000
}
