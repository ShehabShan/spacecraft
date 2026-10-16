// One-off diagnostic (scaffolding): F17b calibration probe (Lead ruling
// 2026-10-16). Read-only: samples the extracted terrainField's slope
// distribution for the recalibrated STEEP params and verifies all three
// scan classes (moderate/steep/cliff + 8-compass local-uniformity gate)
// find sites within the 20,000-try budget; raises mountainAmp in +200 steps
// to 2,800 max if cliff (>70°) is not found. Mirrors the harness scanFor
// EXACTLY (same mulberry32 stream, same order).
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(specifier + '.ts', context)
    } catch {
      // fall through to default resolution
    }
  }
  return next(specifier, context)
}
