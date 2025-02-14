import { Operation } from 'effection';

import type { Effect } from "npm:effection@4.0.0-alpha.7";
export interface Computation<T = unknown> {
  // deno-lint-ignore no-explicit-any
  [Symbol.iterator](): Iterator<Effect<any>, T, any>;
}
