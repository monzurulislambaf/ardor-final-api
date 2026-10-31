export interface ErrorDetail {
  field?: string;
  message: string;
}

/**
 * Operational error that is safe to show to API clients.
 * Throw it (or one of the helpers below) from services and middlewares;
 * the central error middleware turns it into the standard error response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: ErrorDetail[];
  public readonly isOperational = true;

  constructor(message: string, statusCode = 500, errors: ErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors: ErrorDetail[] = []): AppError {
    return new AppError(message, 400, errors);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message = 'Resource already exists', errors: ErrorDetail[] = []): AppError {
    return new AppError(message, 409, errors);
  }

  static unprocessable(message = 'Unprocessable entity', errors: ErrorDetail[] = []): AppError {
    return new AppError(message, 422, errors);
  }

  static tooManyRequests(message = 'Too many requests, please try again later'): AppError {
    return new AppError(message, 429);
  }
}
