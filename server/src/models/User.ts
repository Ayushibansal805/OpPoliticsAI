import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const output = ret as Record<string, unknown>; delete output.passwordHash; delete output.__v; return output; } },
  },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = mongoose.models.User || mongoose.model<User>('User', userSchema);

export function publicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    themePreference: user.themePreference,
  };
}
