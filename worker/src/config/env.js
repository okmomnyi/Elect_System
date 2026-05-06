/**
 * Worker config stub — re-exports backend env config.
 * The standalone worker (worker/src/worker.js) now imports backend config
 * directly; this file exists for reference/tooling compatibility only.
 */
module.exports = require('../../../backend/src/config/env');
