import type { Instruction } from "npm:effection@4.0.0-alpha.6";
export interface Computation<T = unknown> {
  // deno-lint-ignore no-explicit-any
  [Symbol.iterator](): Iterator<Instruction, T, any>;
}
