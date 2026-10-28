import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { publicUser } from '../models/User.js';
import { preferenceSchema, profileSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user!) } });
}));

router.patch('/me', asyncHandler(async (req, res) => {
  const input = profileSchema.parse(req.body);
  req.user!.name = input.name;
  await req.user!.save();
  res.json({ success: true, data: { user: publicUser(req.user!) }, message: 'Profile updated.' });
}));

router.patch('/me/preferences', asyncHandler(async (req, res) => {
  const input = preferenceSchema.parse(req.body);
  req.user!.themePreference = input.themePreference;
  await req.user!.save();
  res.json({ success: true, data: { user: publicUser(req.user!) }, message: 'Preferences saved.' });
}));

export default router;
