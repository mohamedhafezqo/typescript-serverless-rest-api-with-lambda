import type { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { ValidationError } from "../services/exceptions";
import type { HttpError } from "../types/http";

// Response builders
export function success<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({ data }),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function created<T>(data: T): APIGatewayProxyResult {
  return success(data, 201);
}

export function badRequest(
  message: string,
  errors?: unknown[],
): APIGatewayProxyResult {
  const errorResponse: HttpError = {
    message,
    ...(errors && { errors }),
  };

  return {
    statusCode: 400,
    body: JSON.stringify(errorResponse),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function notFound(message: string): APIGatewayProxyResult {
  const errorResponse: HttpError = {
    message,
  };

  return {
    statusCode: 404,
    body: JSON.stringify(errorResponse),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function internalError(message: string): APIGatewayProxyResult {
  const errorResponse: HttpError = {
    message,
  };

  return {
    statusCode: 500,
    body: JSON.stringify(errorResponse),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

// Request parsers
export function parseRequestBody<T>(
  event: APIGatewayEvent,
  schema: z.ZodSchema<T>,
): T {
  if (!event.body) {
    throw new ValidationError("Request body is required");
  }

  try {
    const parsed = JSON.parse(event.body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Validation failed", error.issues);
    }
    throw new ValidationError("Invalid JSON in request body");
  }
}

export function requirePathParameter(
  event: APIGatewayEvent,
  key: string,
): string {
  const value = event.pathParameters?.[key];
  if (!value) {
    throw new ValidationError(`path parameter '${key}' is required`);
  }
  return value;
}
