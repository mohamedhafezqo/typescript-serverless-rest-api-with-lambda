// Request DTOs
export type CreateDriverRequest = {
  firstname: string;
  lastname: string;
  driverLicenseId: string;
};

// Response DTOs
export type DriverResponse = {
  id: string;
  firstname: string;
  lastname: string;
  driverLicenseId: string;
};
