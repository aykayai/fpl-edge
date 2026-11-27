/* FPL Signals - the full-pool team solve, off the page's thread (26 Nov 2026).
   The Wildcard full solve takes about 2 seconds; on the page it froze every
   click until it finished. The page builds the model, this worker only runs
   solver.Solve on it and posts the answer back with the request's id. */
importScripts("./lp-solver-1.0.3.js");
self.onmessage = e => {
  const { id, model } = e.data || {};
  const t0 = Date.now();
  let result = null;
  try { result = self.solver.Solve(model); } catch (err) { result = null; }
  self.postMessage({ id, result, ms: Date.now() - t0 });
};
