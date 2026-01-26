export type Tip = {
  driverId: string;
  amount: number;
  eventTime: string; // ISO 8601 timestamp
};

// todo to be a dto file
export type TipAggregation = {
  driverId: string;
  aggregationKey: string; // Format: "DAY#2024-01-15" or "WEEK#2024-W03"
  totalAmount: number;
  updatedAt: string; // ISO 8601 timestamp
};
