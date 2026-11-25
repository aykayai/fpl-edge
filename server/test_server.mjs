/* A test's own server, on a port nobody else holds (25 Nov 2026).

   The suites used fixed ports (regression 8093, signals 8097, ...). Two runs
   at once (two sessions testing side by side) then shared a port: the second
   run's server died with EADDRINUSE, but its harness carried on against the
   FIRST run's server, with that run's state, and hit "fetch failed" when it
   shut down. That was the flaky "per-player GW7 pts identical" failure
   (3.777 vs 3.781, the direction flipping run to run).

   freePort: a port the OS says is free right now.
   watchServer: child.ready resolves once THIS server prints its
   "listening on <port>" line, and rejects if it exits first, so a harness
   never mistakes someone else's server for its own. */
import net from "node:net";

export function freePort() {
  return new Promise((ok, bad) => {
    const s = net.createServer();
    s.on("error", bad);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

export function watchServer(child, port, timeoutMs = 60000) {
  let seen = "";
  child.ready = new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(new Error(`test server on port ${port} never said it was listening`)), timeoutMs);
    const onOut = d => {
      seen = (seen + d).slice(-4000);
      if (seen.includes(`listening on ${port}`)) { clearTimeout(timer); ok(); }
    };
    child.stdout && child.stdout.on("data", onOut);
    child.on("exit", (code, sig) => {
      clearTimeout(timer);
      bad(new Error(`test server on port ${port} exited before listening (${code ?? sig}); is another run holding the port?`));
    });
  });
  child.ready.catch(() => {});   /* the harness awaits it; never an unhandled rejection */
  return child;
}
