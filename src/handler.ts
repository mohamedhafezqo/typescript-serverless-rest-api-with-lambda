import type { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CreateDriverRequest } from "./dto/driver.dto";
import { CreateDriverRequestSchema } from "./schemas/driver.schema";
import type { DriverService } from "./services/driver.service";
import { DriverNotFoundError, ValidationError } from "./services/exceptions";
import {
  badRequest,
  created,
  internalError,
  notFound,
  parseRequestBody,
  requirePathParameter,
  success,
} from "./utils/http";
import { toDriverResponse } from "./utils/mappers";

// Handler factory for dependency injection
export const createHandlers = (driverService: DriverService) => {
  return {
    handleCreateDriver: async (
      event: APIGatewayEvent,
    ): Promise<APIGatewayProxyResult> => {
      try {
        // Parse and validate request body
        const requestBody = parseRequestBody<CreateDriverRequest>(
          event,
          CreateDriverRequestSchema,
        );

        // Call service (service will generate UUID)
        const driver = await driverService.createDriver(requestBody);

        // Map domain model to DTO
        const response = toDriverResponse(driver);

        return created(response);
      } catch (error) {
        // Handle validation errors
        if (error instanceof ValidationError) {
          return badRequest(
            error.message,
            error.details ? [error.details] : undefined,
          );
        }

        // Handle other errors
        console.error("Error creating driver:", error);
        return internalError("Failed to create driver");
      }
    },

    handleGetDriver: async (
      event: APIGatewayEvent,
    ): Promise<APIGatewayProxyResult> => {
      try {
        // Extract path parameter
        const id = requirePathParameter(event, "id");

        // Call service (throws DriverNotFoundError if not found)
        const driver = await driverService.getDriverById(id);

        // Map domain model to DTO
        const response = toDriverResponse(driver);

        return success(response);
      } catch (error) {
        // Handle not found error
        if (error instanceof DriverNotFoundError) {
          return notFound(error.message);
        }

        // Handle validation errors
        if (error instanceof ValidationError) {
          return badRequest(
            error.message,
            error.details ? [error.details] : undefined,
          );
        }

        // Handle other errors
        console.error("Error fetching driver:", error);
        return internalError("Failed to fetch driver");
      }
    },

    handleGetDriverTips: async (
      event: APIGatewayEvent,
    ): Promise<APIGatewayProxyResult> => {
      try {
        const id = requirePathParameter(event, "id");

        return success(await driverService.getDriverTips(id));
      } catch (error) {
        console.error("Error fetching driver tips:", error);
        return internalError("Failed to fetch driver tips");
      }
    },
  };
};
