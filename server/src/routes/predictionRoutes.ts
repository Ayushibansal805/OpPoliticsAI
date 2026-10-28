import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { PredictionModel } from '../models/Prediction.js';
import { databaseStatus } from '../config/database.js';
import { predictResolution, MlServiceError } from '../services/mlService.js';
import { listQuerySchema, resolutionPredictionSchema } from '../validators/schemas.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

function requireDatabase() {
  if (!databaseStatus().connected) throw new HttpError(503, 'Prediction history is temporarily unavailable.', 'DATABASE_UNAVAILABLE');
}

const mlResponseSchema = z.object({
  duration: z.number().finite().nonnegative(),
  unit: z.literal('hours'),
  prediction_type: z.literal('point_estimate'),
  model_version: z.string().optional(),
  artifact_generated_at: z.string().optional(),
});

const serialize = (prediction: any) => ({
  id: prediction._id.toString(),
  modelId: prediction.modelId,
  modelVersion: prediction.modelVersion,
  predictionType: prediction.predictionType,
  input: prediction.input,
  output: prediction.output,
  status: prediction.status,
  errorCode: prediction.errorCode,
  createdAt: prediction.createdAt,
});

router.post('/resolution-time', asyncHandler(async (req, res) => {
  requireDatabase();
  const input = resolutionPredictionSchema.parse(req.body);
  try {
    const response = mlResponseSchema.parse(await predictResolution(input));
    const saved = await PredictionModel.create({
      userId: req.user!._id,
      modelId: 'resolution-time',
      modelVersion: response.model_version ?? response.artifact_generated_at,
      predictionType: response.prediction_type,
      input: { issueCreated: new Date(input.issue_created), priority: input.issue_priority, issueType: input.issue_type, project: input.issue_proj },
      output: { duration: response.duration, unit: response.unit },
      status: 'success',
    });
    res.status(201).json({ success: true, data: { prediction: serialize(saved), duration: response.duration, unit: response.unit, predictionType: response.prediction_type, modelId: 'resolution-time', modelVersion: response.model_version ?? response.artifact_generated_at }, message: 'Prediction created.' });
  } catch (error) {
    const code = error instanceof MlServiceError ? error.code : 'ML_INVALID_RESPONSE';
    await PredictionModel.create({
      userId: req.user!._id,
      modelId: 'resolution-time',
      predictionType: 'point_estimate',
      input: { issueCreated: new Date(input.issue_created), priority: input.issue_priority, issueType: input.issue_type, project: input.issue_proj },
      status: 'failed',
      errorCode: code,
    }).catch(() => undefined);
    throw error instanceof MlServiceError ? error : new HttpError(503, 'The model service returned an invalid response.', code);
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  requireDatabase();
  const query = listQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { userId: req.user!._id };
  if (query.modelId) filter.modelId = query.modelId;
  if (query.from || query.to) filter.createdAt = { ...(query.from ? { $gte: new Date(query.from) } : {}), ...(query.to ? { $lte: new Date(query.to) } : {}) };
  const [items, total] = await Promise.all([
    PredictionModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    PredictionModel.countDocuments(filter),
  ]);
  res.json({ success: true, data: { items: items.map(serialize), page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  requireDatabase();
  const prediction = await PredictionModel.findOne({ _id: req.params.id, userId: req.user!._id }).lean();
  if (!prediction) throw new HttpError(404, 'Prediction not found.', 'PREDICTION_NOT_FOUND');
  res.json({ success: true, data: { prediction: serialize(prediction) } });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  requireDatabase();
  const deleted = await PredictionModel.deleteOne({ _id: req.params.id, userId: req.user!._id });
  if (!deleted.deletedCount) throw new HttpError(404, 'Prediction not found.', 'PREDICTION_NOT_FOUND');
  res.json({ success: true, data: null, message: 'Prediction removed.' });
}));

export default router;
