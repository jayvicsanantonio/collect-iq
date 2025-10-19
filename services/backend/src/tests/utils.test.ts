import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../utils/logger.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  formatErrorResponse,
} from '../utils/errors.js';
import {
  validate,
  safeParse,
  sanitizeFilename,
  validateMimeType,
  validateFileSize,
  getEnvVar,
  getEnvArray,
  getEnvNumber,
} from '../utils/validation.js';
import { z } from 'zod';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log info messages', () => {
    logger.info('test message', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalled();
    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logCall);
    expect(parsed.level).toBe('INFO');
    expect(parsed.message).toBe('test message');
    expect(parsed.key).toBe('value');
  });

  it('should log error messages with error object', () => {
    const error = new Error('test error');
    logger.error('error occurred', error, { operation: 'test' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCall = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logCall);
    expect(parsed.level).toBe('ERROR');
    expect(parsed.message).toBe('error occurred');
    expect(parsed.error.message).toBe('test error');
  });
});

describe('Error Handling', () => {
  it('should create BadRequestError with correct properties', () => {
    const error = new BadRequestError('Invalid input', '/api/test');
    expect(error.status).toBe(400);
    expect(error.title).toBe('Bad Request');
    expect(error.detail).toBe('Invalid input');
    expect(error.instance).toBe('/api/test');
  });

  it('should create NotFoundError with correct properties', () => {
    const error = new NotFoundError('Resource not found');
    expect(error.status).toBe(404);
    expect(error.title).toBe('Not Found');
  });

  it('should create ForbiddenError with correct properties', () => {
    const error = new ForbiddenError('Access denied', '/api/cards/123');
    expect(error.status).toBe(403);
    expect(error.title).toBe('Forbidden');
  });

  it('should format error response correctly', () => {
    const error = new BadRequestError('Invalid data', '/api/test');
    const response = formatErrorResponse(error, 'req-123');

    expect(response.statusCode).toBe(400);
    expect(response.headers['Content-Type']).toBe('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.status).toBe(400);
    expect(body.detail).toBe('Invalid data');
    expect(body.requestId).toBe('req-123');
  });

  it('should format generic Error as 500', () => {
    const error = new Error('Something went wrong');
    const response = formatErrorResponse(error);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.status).toBe(500);
    expect(body.title).toBe('Internal Server Error');
  });
});

describe('Validation', () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number().min(0),
  });

  it('should validate valid data', () => {
    const data = { name: 'John', age: 30 };
    const result = validate(TestSchema, data);
    expect(result).toEqual(data);
  });

  it('should throw BadRequestError for invalid data', () => {
    const data = { name: 'John', age: -5 };
    expect(() => validate(TestSchema, data)).toThrow(BadRequestError);
  });

  it('should safe parse valid data', () => {
    const data = { name: 'John', age: 30 };
    const result = safeParse(TestSchema, data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(data);
    }
  });

  it('should safe parse invalid data without throwing', () => {
    const data = { name: 'John', age: -5 };
    const result = safeParse(TestSchema, data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should sanitize filename', () => {
    expect(sanitizeFilename('test file.jpg')).toBe('test_file.jpg');
    expect(sanitizeFilename('test@#$%file.png')).toBe('test_file.png'); // Multiple underscores collapsed
    expect(sanitizeFilename('test__file.jpg')).toBe('test_file.jpg');
  });

  it('should validate MIME type', () => {
    expect(validateMimeType('image/jpeg', ['image/jpeg', 'image/png'])).toBe(true);
    expect(validateMimeType('image/gif', ['image/jpeg', 'image/png'])).toBe(false);
  });

  it('should validate file size', () => {
    expect(validateFileSize(1024 * 1024, 2)).toBe(true); // 1MB < 2MB
    expect(validateFileSize(3 * 1024 * 1024, 2)).toBe(false); // 3MB > 2MB
    expect(validateFileSize(0, 2)).toBe(false); // 0 bytes invalid
  });
});

describe('Environment Variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should get environment variable', () => {
    process.env.TEST_VAR = 'test-value';
    expect(getEnvVar('TEST_VAR')).toBe('test-value');
  });

  it('should use default value if not set', () => {
    expect(getEnvVar('MISSING_VAR', 'default')).toBe('default');
  });

  it('should throw if required variable missing', () => {
    expect(() => getEnvVar('MISSING_VAR')).toThrow();
  });

  it('should parse array from comma-separated string', () => {
    process.env.TEST_ARRAY = 'value1,value2,value3';
    expect(getEnvArray('TEST_ARRAY')).toEqual(['value1', 'value2', 'value3']);
  });

  it('should return default array if not set', () => {
    expect(getEnvArray('MISSING_ARRAY', ['default'])).toEqual(['default']);
  });

  it('should parse numeric environment variable', () => {
    process.env.TEST_NUMBER = '42';
    expect(getEnvNumber('TEST_NUMBER')).toBe(42);
  });

  it('should use default number if not set', () => {
    expect(getEnvNumber('MISSING_NUMBER', 10)).toBe(10);
  });

  it('should throw for invalid numeric value', () => {
    process.env.TEST_NUMBER = 'not-a-number';
    expect(() => getEnvNumber('TEST_NUMBER')).toThrow();
  });
});
