import {log, LogLevel, settings} from "log";
import * as Profiler from "screeps-profiler";

// Any code written outside the `loop()` method is executed only when the
// Screeps system reloads your script.
// Use this bootstrap wisely. You can cache some of your stuff to save CPU.
// You should extend prototypes before the game loop executes here.

// This is an example for using a config variable from `config.ts`.
// NOTE: this is used as an example, you may have better performance
// by setting USE_PROFILER through webpack, if you want to permanently
// remove it on deploy
// Start the profiler
if (settings.profile.enabled) {
  Profiler.enable();
}

log("main", `loading revision: ${__REVISION__}`);

function mloop() {
  // Check memory for null or out of bounds custom objects
  if (!Memory.uuid || Memory.uuid > 100) {
    Memory.uuid = 0;
  }
}

/**
 * Screeps system expects this "loop" method in main.js to run the
 * application. If we have this line, we can be sure that the globals are
 * bootstrapped properly and the game loop is executed.
 * http://support.screeps.com/hc/en-us/articles/204825672-New-main-loop-architecture
 *
 * @export
 */
export const loop = !settings.profile.enabled ? mloop : () => { Profiler.wrap(mloop); };
