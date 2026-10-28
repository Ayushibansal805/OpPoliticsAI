import { z } from 'zod';

const dateString = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid creation timestamp.');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid work email.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(128),
  termsAccepted: z.literal(true, { error: 'Accept the terms to create an account.' }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().optional().default(false),
});

export const resolutionPredictionSchema = z.object({
  issue_created: dateString,
  issue_priority: z.string().trim().min(1).max(100),
  issue_type: z.string().trim().min(1).max(100),
  issue_proj: z.string().trim().min(1).max(200),
});

export const profileSchema = z.object({ name: z.string().trim().min(2).max(100) });
export const preferenceSchema = z.object({ themePreference: z.enum(['light', 'dark', 'system']) });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  modelId: z.string().trim().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
