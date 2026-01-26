import type { TipAggregation } from "../models/tip.model";
import type { TipEvent } from "../models/tip-event.model";

export interface TipRepository {
  /**
   * Apply a tip event by updating day/week aggregations
   */
  applyTip(event: TipEvent): Promise<void>;

  /**
   * Update the aggregation for a tip event
   */
  updateAggregation(
    driverId: string,
    aggregationKey: string,
    amount: number,
    now: string,
  ): Promise<void>;

  getDailyTotal(driverId: string, day: string): Promise<TipAggregation | null>;
  getWeeklyTotal(
    driverId: string,
    week: string,
  ): Promise<TipAggregation | null>;
}
