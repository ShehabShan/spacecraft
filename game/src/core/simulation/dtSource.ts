// T5 S1bbbbbbb (F5a): frame-dt source for hot per-frame callees.
// WHY: a double passed as an ARGUMENT to a non-inlined call is boxed into a
// fresh HeapNumber at the call site (T5 S1bbbbba probe: 130.5 vs 16.5 B/call).
// Hot callees therefore read dt from a source object (PlayClock in play) once,
// and the old numeric-arg forms stay as thin wrappers over a DtCell.
// core imports nothing from play: play's PlayClock satisfies DtSource
// structurally.

/** Anything that carries this frame's dt (s) as a field. */
export interface DtSource { readonly dt: number }

/** Class-backed dt cell (own hidden class, unboxed double field) for the
 *  numeric-arg wrappers. Boot-allocate one per owner; never per call. */
export class DtCell implements DtSource {
  dt = 0;
}