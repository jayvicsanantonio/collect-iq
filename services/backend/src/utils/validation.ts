/**
 * Validation helpers using Zod
 */

import { z, ZodError } from 'zod';
import { BadRequestError } from './errors.js';

/**
 * Validate data against a Zod schema
 * Throws BadRequestError with detailed validation errors
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      throw new BadRequestError('Validation failed', '', { validationErrors: errors });
    }
    throw error;
  }
}

/**
 * Safe parse that returns result without throwing
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
):
  | { success: true; data: T }
  | { success: false; errors: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  return { success: false, errors };
}

/**
 * Sanitize filename for S3 keys
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Validate MIME type against allowed list
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number, maxMB: number): boolean {
  const maxBytes = maxMB * 1024 * 1024;
  return sizeBytes > 0 && sizeBytes <= maxBytes;
}

/**
 * Parse and validate environment variable
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue!;
}

/**
 * Parse comma-separated environment variable
 */
export function getEnvArray(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Parse numeric environment variable
 */
export function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return defaultValue;
  }
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid numeric value for environment variable ${name}: ${value}`);
  }
  return parsed;
}
