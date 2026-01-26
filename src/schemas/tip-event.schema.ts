import { z } from "zod";

export const TipEventSchema = z.object({
  driverId: z.string().min(1, "driverId is required"),
  amount: z.coerce.number().positive("amount must be a positive number"),
  eventTime: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !Number.isNaN(date.getTime());
    },
    { message: "eventTime must be a valid ISO 8601 datetime" },
  ),
});
