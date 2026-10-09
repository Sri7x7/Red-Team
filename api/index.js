// @ts-check
/**
 * @file api/index.js
 * @description Serverless function entry point for Vercel deployment.
 * Exports the Express app instance configured via createApp().
 */

import { createApp } from '../server.js';

const app = createApp();

export default app;
