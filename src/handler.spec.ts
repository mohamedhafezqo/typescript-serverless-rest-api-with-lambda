import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";

import { createHandlers } from "./handler";
import type { DriverRepository } from "./repositories/driver-repository";
import type { TipRepository } from "./repositories/tip-repository";
import { DriverService } from "./services/driver.service";

function createMockRepository(): DriverRepository {
  return {
    findById: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
  };
}

function createMockTipRepository(): TipRepository {
  return {
    applyTip: vi.fn(),
    updateAggregation: vi.fn(),
    getDailyTotal: vi.fn(),
    getWeeklyTotal: vi.fn(),
  };
}

describe("handler", () => {
  it("get driver should return bad request when id parameter missing", async () => {
    // Arrange
    const mockDriverRepository = createMockRepository();
    const mockTipRepository = createMockTipRepository();
    const service = new DriverService(mockDriverRepository, mockTipRepository);

    const handlers = createHandlers(service);

    // Act
    const response = await handlers.handleGetDriver(
      {} as unknown as APIGatewayProxyEvent,
    );

    // Assert
    expect(response.statusCode).toBe(400);
    expect(mockDriverRepository.findById).not.toHaveBeenCalled();
  });

  it("get driver should return not found when driver not found", async () => {
    // Arrange
    const mockDriverRepository = createMockRepository();
    const mockTipRepository = createMockTipRepository();
    mockTipRepository.getDailyTotal = vi.fn().mockResolvedValue(null);
    const service = new DriverService(mockDriverRepository, mockTipRepository);
    const handlers = createHandlers(service);

    // Act
    const response = await handlers.handleGetDriver({
      pathParameters: {
        id: "i-do-not-exist",
      },
    } as unknown as APIGatewayProxyEvent);

    // Assert
    expect(response.statusCode).toBe(404);
    expect(mockDriverRepository.findById).toHaveBeenCalledWith(
      "i-do-not-exist",
    );
  });
});
