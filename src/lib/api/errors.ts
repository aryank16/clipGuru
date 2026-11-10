/**
 * Error codes and HTTP statuses from the ClipGuru API Design ("Error codes" section).
 * The UI decides what to show from `code`, never from `message`.
 */
export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  BRIEF_INCOMPLETE: 400,
  STORYBOARD_INVALID: 400,
  TOO_FEW_SCENES: 400,
  CAPTION_TOO_LONG: 400,
  TOO_MANY_HASHTAGS: 400,
  SCHEDULE_OUT_OF_RANGE: 400,
  FORBIDDEN_ORIGIN: 403,
  REV_CONFLICT: 409,
  BRIEF_LOCKED: 409,
  STORYBOARD_EXISTS: 409,
  NOTHING_TO_UNDO: 409,
  SCENE_NOT_FOUND: 404,
  RENDER_RUNNING: 409,
  RENDER_NOT_READY: 409,
  RENDER_NOT_LATEST: 409,
  NOT_RETRYABLE: 409,
  ALREADY_POSTED: 409,
  POST_LOCKED: 409,
  INSTAGRAM_NOT_CONNECTED: 409,
  INSTAGRAM_RECONNECT_NEEDED: 409,
  CONTENT_BLOCKED: 422,
  LIMIT_REACHED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const DEFAULT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  NOT_FOUND: "This no longer exists.",
  VALIDATION_FAILED: "Some fields need fixing.",
  FORBIDDEN_ORIGIN: "Request blocked.",
  REV_CONFLICT: "This changed in another tab.",
  INTERNAL: "Something went wrong.",
};

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
};

/** Throw from a route handler; `route()` turns it into the standard error body. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code] ?? code);
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
