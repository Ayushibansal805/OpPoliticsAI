import { Router } from 'express';
import { databaseStatus } from '../config/database.js';
<<<<<<< HEAD
import { checkDelayRiskHealth, checkMlHealth, checkWorkloadForecastHealth } from '../services/mlService.js';
=======
import { checkMlHealth } from '../services/mlService.js';
>>>>>>> origin/main

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'opspilot-api', timestamp: new Date().toISOString() } });
});

router.get('/ready', async (_req, res) => {
  const database = databaseStatus();
<<<<<<< HEAD
  const [ml, delayRisk, workload] = await Promise.all([checkMlHealth(), checkDelayRiskHealth(), checkWorkloadForecastHealth()]);
  const ready = database.connected && ml.available && delayRisk.available && workload.available;
  res.status(ready ? 200 : 503).json({ success: ready, data: { status: ready ? 'ready' : 'not_ready', database, resolution: ml.data, delayRisk: delayRisk.data, workload: workload.data }, message: ready ? 'All decision-pipeline services are ready.' : 'One or more required services are unavailable.' });
=======
  const ml = await checkMlHealth();
  const ready = database.connected && ml.available;
  res.status(ready ? 200 : 503).json({ success: ready, data: { status: ready ? 'ready' : 'not_ready', database, ml: ml.data }, message: ready ? 'All required services are ready.' : 'One or more required services are unavailable.' });
>>>>>>> origin/main
});

export default router;
