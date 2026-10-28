// -----------------------------------------------------------------------------
// Entry point of the Lignes d'Azur external integration.
//
// Brings the trams and buses of Nice (Lignes d'Azur, Métropole Nice Côte
// d'Azur) into Gladys, through the official open data of the network (GTFS
// and GTFS-RT, no key):
//   - devices: one per followed stop, with the next passages, the waits and
//     the delay in real time (src/device.js);
//   - scene triggers: departure soon, departure cancelled;
//   - scene action: read the next passages of a stop;
//   - dashboard widget: departures.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Lignes d'Azur integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
