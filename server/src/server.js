import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { startScheduler } from './services/scanRunner.js';

await mongoose.connect(env.mongoUri);
console.log('MongoDB connected');
createApp().listen(env.port, () => console.log(`SecureScope API on :${env.port}`));
if (env.schedulerEnabled) startScheduler();
if (env.allowPrivateTargets) console.warn('⚠ ALLOW_PRIVATE_TARGETS is on (dev only): SSRF protection relaxed');
