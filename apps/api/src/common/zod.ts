import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod/v3';

export function parseWithSchema<Schema extends z.ZodTypeAny>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new BadRequestException({
    code: 'validation_failed',
    message: '请求参数不符合要求',
    details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}
