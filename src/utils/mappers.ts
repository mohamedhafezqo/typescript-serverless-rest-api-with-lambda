import type { DriverResponse } from "../dto/driver.dto";
import type { Driver } from "../models/driver.model";

export function toDriverResponse(driver: Driver): DriverResponse {
  return {
    id: driver.id,
    firstname: driver.firstname,
    lastname: driver.lastname,
    driverLicenseId: driver.driverLicenseId,
  };
}
