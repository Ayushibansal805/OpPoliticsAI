import mongoose, { type InferSchemaType } from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    modelId: { type: String, required: true, index: true },
    modelVersion: { type: String },
    predictionType: { type: String, required: true },
    input: {
      issueCreated: { type: Date, required: true },
      priority: { type: String, required: true },
      issueType: { type: String, required: true },
      project: { type: String, required: true },
    },
    output: {
      duration: { type: Number, min: 0 },
      unit: { type: String, enum: ['hours'], default: 'hours' },
    },
    status: { type: String, enum: ['success', 'failed'], required: true, index: true },
    errorCode: { type: String },
  },
  { timestamps: true },
);

predictionSchema.index({ userId: 1, createdAt: -1 });
predictionSchema.index({ userId: 1, modelId: 1, createdAt: -1 });
export type Prediction = InferSchemaType<typeof predictionSchema>;
export const PredictionModel = mongoose.models.Prediction || mongoose.model<Prediction>('Prediction', predictionSchema);
