import { randomUUID } from "node:crypto";
import type { CreateDriverRequest } from "../dto/driver.dto";
import type { Driver } from "../models/driver.model";
import type { TipAggregation } from "../models/tip.model";
import type { DriverRepository } from "../repositories/driver-repository";
import type { TipRepository } from "../repositories/tip-repository";
import { dayBucket, weekBucket } from "../utils/time-buckets";
import { DriverNotFoundError } from "./exceptions";

export class DriverService {
  constructor(
    private driverRepository: DriverRepository,
    private tipRepository: TipRepository,
  ) {}

  async createDriver(request: CreateDriverRequest): Promise<Driver> {
    const driver: Driver = {
      id: randomUUID(),
      firstname: request.firstname,
      lastname: request.lastname,
      driverLicenseId: request.driverLicenseId,
    };

    return this.driverRepository.create(driver);
  }

  async getDriverById(id: string): Promise<Driver> {
    const driver = await this.driverRepository.findById(id);
    if (!driver) {
      throw new DriverNotFoundError(id);
    }
    return driver;
  }

  async getDrivers(): Promise<Driver[]> {
    return this.driverRepository.findAll();
  }

  async getDriverTips(
    driverId: string,
  ): Promise<{ daily: TipAggregation; weekly: TipAggregation }> {
    // Ensure driver exists (business rule)
    await this.getDriverById(driverId);

    const today = dayBucket(new Date().toISOString());
    const week = weekBucket(new Date().toISOString());

    const [daily, weekly] = await Promise.all([
      this.tipRepository.getDailyTotal(driverId, today),
      this.tipRepository.getWeeklyTotal(driverId, week),
    ]);

    return { daily, weekly };
  }
}
