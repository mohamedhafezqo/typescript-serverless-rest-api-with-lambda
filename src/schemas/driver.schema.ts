import { z } from "zod";

export const CreateDriverRequestSchema = z.object({
  firstname: z.string().min(1, "firstname is required"),
  lastname: z.string().min(1, "lastname is required"),
  driverLicenseId: z.string().min(1, "driverLicenseId is required"),
});
