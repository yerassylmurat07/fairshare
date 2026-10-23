// Run the native node:test suites in one process: no tsx CLI IPC socket is needed.
import "../server/allocation.test.js";
import "../server/app.test.js";
import "../server/auth.test.js";
import "../server/invariants.test.js";
