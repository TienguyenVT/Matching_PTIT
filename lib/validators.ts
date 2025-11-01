import { z } from 'zod';

export const courseIdSchema = z.string().uuid();
export const roomIdSchema = z.string().uuid();

export const registerCourseBody = z.object({
  courseId: courseIdSchema,
});

export const matchUserBody = z.object({
  courseId: courseIdSchema,
});

export const messageBody = z.object({
  roomId: roomIdSchema,
  content: z.string().max(2000).optional(),
  type: z.enum(['text', 'image', 'audio', 'video', 'file']).default('text'),
  fileUrl: z.string().url().optional(),
});


