import { z } from 'zod';
import { ROLES, PERMISSIONS } from '../constants/index.js';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum([ROLES.ADMIN, ROLES.OWNER, ROLES.VIEWER]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  description: z.string().max(2000).optional(),
});

export const grantPermissionSchema = z.object({
  email: z.string().email('Target user email is required'),
  permission: z.enum([PERMISSIONS.READ, PERMISSIONS.EDIT]),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export const aiRecommendSchema = z.object({
  purpose: z.string().max(500).optional(),
});

export const aiDecisionSchema = z.object({
  recommendationId: z.string().optional(),
  targetUserId: z.string(),
  decision: z.enum(['accepted', 'rejected']),
  permission: z.enum([PERMISSIONS.READ, PERMISSIONS.EDIT]).optional(),
  reason: z.string().max(500).optional(),
});
