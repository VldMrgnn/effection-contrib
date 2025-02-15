import type { Callable, Operation, Channel, Result } from "npm:effection@4.0.0-alpha.7";
import { call, createChannel, resource, spawn } from 'npm:effection@4.0.0-alpha.7';

import { safe } from './safe.ts';

export interface ParallelRet<T> extends Operation<Result<T>[]> {
  sequence: Channel<Result<T>, void>;
  immediate: Channel<Result<T>, void>;
}

/**
 * The goal of `parallel` is to make it easier to cooridnate multiple async
 * operations in parallel, with different ways to receive completed tasks.
 *
 * All tasks are called with {@link fx.safe} which means they will never
 * throw an exception.  Instead all tasks will return a Result object that
 * the end development must evaluate in order to grab the value.
 *
 * @example
 * ```ts
 * import { parallel } from "starfx";
 *
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  // wait for all tasks to complete before moving to next yield point
 *  const results = yield* task;
 *  // job1 = results[0];
 *  // job2 = results[1];
 * }
 * ```
 *
 * Instead of waiting for all tasks to complete, we can instead loop over
 * tasks as they arrive:
 *
 * @example
 * ```ts
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  for (const job of yield* each(task.immediate)) {
 *    // job2 completes first then it will be first in list
 *    console.log(job);
 *    yield* each.next();
 *  }
 * }
 * ```
 *
 * Or we can instead loop over tasks in order of the array provided to
 * parallel:
 *
 * @example
 * ```ts
 * function* run() {
 *  const task = yield* parallel([job1, job2]);
 *  for (const job of yield* each(task.sequence)) {
 *    // job1 then job2 will be returned regardless of when the jobs
 *    // complete
 *    console.log(job);
 *    yield* each.next();
 *  }
 * }
 * ```
 */
export function parallel<T>(operations: Callable<T>[]) {
  const sequence = createChannel<Result<T>, void>();
  const immediate = createChannel<Result<T>, void>();
  const results: Result<T>[] = [];

  function wrapOperation(op: Callable<T>) {
    return function* () {
      const candidate = op;
      // deno-lint-ignore no-explicit-any
      if (candidate != null && typeof (candidate as any).then === "function") {
        return (() => candidate) as Callable<T>;
      }
      // deno-lint-ignore no-explicit-any
      else if (candidate != null && typeof (candidate as any).next === "function") {
        return candidate as Callable<T>;
      }
      else {
        return (()=>candidate) as Callable<T>;
      }
    };
  }
  return resource<ParallelRet<T>>(function* (provide) {
    const task = yield* spawn(function* () {
      const tasks = [];
      for (const op of operations) {
        tasks.push(
          yield* spawn(function* () {
            const wrapped = wrapOperation(op);
            const normalized = yield* call(wrapped); 
            const result = yield* safe(normalized);         
            yield* immediate.send(result);
            return result;
          })
        );
      }

      for (const tsk of tasks) {
        const res = yield* tsk;
        results.push(res);
        yield* sequence.send(res);
      }

      yield* sequence.close();
      yield* immediate.close();
    });

    function* wait() {
      yield* task;
      return results;
    }

    yield* provide({
      sequence,
      immediate,
      *[Symbol.iterator]() {
        return yield* wait();
      },
    });
  });
}

/* -------------------------------------------------------------------------- */

// export function parallel__initial<T>(operations: Callable<T>[]) {
//   const sequence = createChannel<Result<T>,void>();
//   const immediate = createChannel<Result<T>,void>();
//   const results: Result<T>[] = [];

//   return resource<ParallelRet<T>>(function* (provide) {
//     const task = yield* spawn(function* () {
//       const tasks = [];
//       for (const op of operations) {
//         tasks.push(
//           yield* spawn(function* () {
                       
//             const result = yield*safe(op);
//             yield* immediate.send(result);
//             return result;
//           }),
//         );
//       }

//       for (const tsk of tasks) {
//         const res = yield* tsk;
//         results.push(res);
//         yield* sequence.send(res);
//       }

//       yield* sequence.close();
//       yield* immediate.close();
//     });

//     function* wait() {
//       yield* task;
//       return results;
//     }

//     yield* provide({
//       sequence,
//       immediate,
//       *[Symbol.iterator]() {
//         return yield* wait(); 
//       },
//     });
//   });
// }