// HttpError class for clean error responses
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new HttpError(400, message, details);
  }
  static unauthorized(message = 'Not authenticated') {
    return new HttpError(401, message);
  }
  static forbidden(message = 'You do not have permission to do this') {
    return new HttpError(403, message);
  }
  static notFound(message = 'Not found') {
    return new HttpError(404, message);
  }
  static conflict(message = 'Conflict') {
    return new HttpError(409, message);
  }
}