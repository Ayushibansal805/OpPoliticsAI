import { Router } from 'express';
import { databaseStatus } from '../config/database.js';
import { checkMlHealth } from '../services/mlService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'opspilot-api', timestamp: new Date().toISOString() } });
});

router.get('/ready', async (_req, res) => {
  const database = databaseStatus();
  const ml = await checkMlHealth();
  const ready = database.connected && ml.available;
  res.status(ready ? 200 : 503).json({ success: ready, data: { status: ready ? 'ready' : 'not_ready', database, ml: ml.data }, message: ready ? 'All required services are ready.' : 'One or more required services are unavailable.' });
});

export default router;
