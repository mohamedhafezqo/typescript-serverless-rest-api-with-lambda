import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateDriverRequest } from "../dto/driver.dto";
import type { Driver } from "../models/driver.model";
import type { TipAggregation } from "../models/tip.model";
import type { DriverRepository } from "../repositories/driver-repository";
import type { TipRepository } from "../repositories/tip-repository";
import { DriverService } from "./driver.service";
import { DriverNotFoundError } from "./exceptions";

function createMockDriverRepository(): DriverRepository {
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

describe("DriverService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createDriver", () => {
    it("should create a driver with generated UUID and call repository", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const request: CreateDriverRequest = {
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      const expectedDriver: Driver = {
        id: expect.any(String),
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      const createdDriver: Driver = {
        id: randomUUID(),
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      mockDriverRepository.create = vi.fn().mockResolvedValue(createdDriver);

      // Act
      const result = await service.createDriver(request);

      // Assert
      expect(mockDriverRepository.create).toHaveBeenCalledTimes(1);
      expect(mockDriverRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(expectedDriver),
      );
      expect(result).toEqual(createdDriver);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
    });

    it("should generate unique UUIDs for different drivers", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const request1: CreateDriverRequest = {
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      const request2: CreateDriverRequest = {
        firstname: "Jane",
        lastname: "Smith",
        driverLicenseId: "DL789012",
      };

      let firstId: string | undefined;
      let secondId: string | undefined;

      mockDriverRepository.create = vi
        .fn()
        .mockImplementation((driver: Driver) => {
          if (driver.firstname === "John") {
            firstId = driver.id;
            return Promise.resolve(driver);
          }
          secondId = driver.id;
          return Promise.resolve(driver);
        });

      // Act
      await service.createDriver(request1);
      await service.createDriver(request2);

      // Assert
      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();
      expect(firstId).not.toBe(secondId);
    });
  });

  describe("getDriverById", () => {
    it("should return driver when found", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const driverId = "driver-123";
      const expectedDriver: Driver = {
        id: driverId,
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      mockDriverRepository.findById = vi
        .fn()
        .mockResolvedValue(expectedDriver);

      // Act
      const result = await service.getDriverById(driverId);

      // Assert
      expect(mockDriverRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockDriverRepository.findById).toHaveBeenCalledWith(driverId);
      expect(result).toEqual(expectedDriver);
    });

    it("should throw DriverNotFoundError when driver not found", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const driverId = "non-existent-id";

      mockDriverRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.getDriverById(driverId)).rejects.toThrow(
        DriverNotFoundError,
      );
      await expect(service.getDriverById(driverId)).rejects.toThrow(
        `Driver with id '${driverId}' not found`,
      );
      expect(mockDriverRepository.findById).toHaveBeenCalledWith(driverId);
    });
  });

  describe("getDrivers", () => {
    it("should return all drivers from repository", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const expectedDrivers: Driver[] = [
        {
          id: "driver-1",
          firstname: "John",
          lastname: "Doe",
          driverLicenseId: "DL123456",
        },
        {
          id: "driver-2",
          firstname: "Jane",
          lastname: "Smith",
          driverLicenseId: "DL789012",
        },
      ];

      mockDriverRepository.findAll = vi
        .fn()
        .mockResolvedValue(expectedDrivers);

      // Act
      const result = await service.getDrivers();

      // Assert
      expect(mockDriverRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedDrivers);
    });

    it("should return empty array when no drivers exist", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      mockDriverRepository.findAll = vi.fn().mockResolvedValue([]);

      // Act
      const result = await service.getDrivers();

      // Assert
      expect(mockDriverRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe("getDriverTips", () => {
    it("should return daily and weekly tip aggregations for existing driver", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const driverId = "driver-123";
      const driver: Driver = {
        id: driverId,
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      const now = new Date("2024-01-15T10:30:00Z");
      const today = "2024-01-15";
      const week = "2024-W03";

      const dailyAggregation: TipAggregation = {
        driverId,
        aggregationKey: `DAY#${today}`,
        totalAmount: 50.0,
        updatedAt: now.toISOString(),
      };

      const weeklyAggregation: TipAggregation = {
        driverId,
        aggregationKey: `WEEK#${week}`,
        totalAmount: 150.0,
        updatedAt: now.toISOString(),
      };

      mockDriverRepository.findById = vi.fn().mockResolvedValue(driver);
      mockTipRepository.getDailyTotal = vi
        .fn()
        .mockResolvedValue(dailyAggregation);
      mockTipRepository.getWeeklyTotal = vi
        .fn()
        .mockResolvedValue(weeklyAggregation);

      // Mock Date to have consistent test results
      vi.setSystemTime(now);

      // Act
      const result = await service.getDriverTips(driverId);

      // Assert
      expect(mockDriverRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockDriverRepository.findById).toHaveBeenCalledWith(driverId);
      expect(mockTipRepository.getDailyTotal).toHaveBeenCalledTimes(1);
      expect(mockTipRepository.getDailyTotal).toHaveBeenCalledWith(
        driverId,
        today,
      );
      expect(mockTipRepository.getWeeklyTotal).toHaveBeenCalledTimes(1);
      expect(mockTipRepository.getWeeklyTotal).toHaveBeenCalledWith(
        driverId,
        week,
      );
      expect(result).toEqual({
        daily: dailyAggregation,
        weekly: weeklyAggregation,
      });
    });

    it("should throw DriverNotFoundError when driver does not exist", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const driverId = "non-existent-id";

      mockDriverRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.getDriverTips(driverId)).rejects.toThrow(
        DriverNotFoundError,
      );
      expect(mockDriverRepository.findById).toHaveBeenCalledWith(driverId);
      expect(mockTipRepository.getDailyTotal).not.toHaveBeenCalled();
      expect(mockTipRepository.getWeeklyTotal).not.toHaveBeenCalled();
    });

    it("should handle null aggregations when no tips exist", async () => {
      // Arrange
      const mockDriverRepository = createMockDriverRepository();
      const mockTipRepository = createMockTipRepository();
      const service = new DriverService(mockDriverRepository, mockTipRepository);

      const driverId = "driver-123";
      const driver: Driver = {
        id: driverId,
        firstname: "John",
        lastname: "Doe",
        driverLicenseId: "DL123456",
      };

      const now = new Date("2024-01-15T10:30:00Z");
      const today = "2024-01-15";
      const week = "2024-W03";

      mockDriverRepository.findById = vi.fn().mockResolvedValue(driver);
      mockTipRepository.getDailyTotal = vi.fn().mockResolvedValue(null);
      mockTipRepository.getWeeklyTotal = vi.fn().mockResolvedValue(null);

      // Mock Date
      vi.setSystemTime(now);

      // Act
      const result = await service.getDriverTips(driverId);

      // Assert
      expect(result).toEqual({
        daily: null,
        weekly: null,
      });
    });
  });
});
