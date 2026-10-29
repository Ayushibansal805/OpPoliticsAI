import { Router } from 'express';
<<<<<<< HEAD
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { publicUser, UserModel } from '../models/User.js';
import { preferenceSchema, profileSchema, userRoleSchema } from '../validators/schemas.js';
=======
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { publicUser } from '../models/User.js';
import { preferenceSchema, profileSchema } from '../validators/schemas.js';
>>>>>>> origin/main

const router = Router();
router.use(requireAuth);

<<<<<<< HEAD
router.get('/', requireRole('admin'), asyncHandler(async (_req, res) => {
  const users = await UserModel.find({}).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { users: users.map((user: any) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role === 'user' ? 'customer' : user.role, createdAt: user.createdAt })) } });
}));

router.patch('/:userId/role', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = userRoleSchema.parse(req.body);
  if (req.params.userId === req.user!._id.toString() && input.role !== 'admin') throw new HttpError(400, 'You cannot remove your own admin access.', 'CANNOT_DEMOTE_SELF');
  const target = await UserModel.findById(req.params.userId);
  if (!target) throw new HttpError(404, 'User not found.', 'USER_NOT_FOUND');
  if (target.role === 'admin' && input.role !== 'admin' && await UserModel.countDocuments({ role: 'admin' }) <= 1) throw new HttpError(400, 'The workspace must keep at least one admin.', 'LAST_ADMIN');
  target.role = input.role;
  await target.save();
  res.json({ success: true, data: { user: publicUser(target) }, message: 'Workspace role updated.' });
}));

=======
>>>>>>> origin/main
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
