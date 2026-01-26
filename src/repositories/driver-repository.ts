import type { Driver } from "../models/driver.model";

export interface DriverRepository {
  findById(id: string): Promise<Driver | null>;
  create(driver: Driver): Promise<Driver>;
  findAll(): Promise<Driver[]>;
}
