import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import type { TipAggregation } from "../models/tip.model";
import type { TipEvent } from "../models/tip-event.model";
import { dayBucket, weekBucket } from "../utils/time-buckets";
import type { TipRepository } from "./tip-repository";

const TABLE_NAME = "challenge-cloud-native-driver-tips-ts";

export class DynamoTipRepository implements TipRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client?: DynamoDBDocumentClient, tableName: string = TABLE_NAME) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName = tableName;
  }

  async applyTip(event: TipEvent): Promise<void> {
    const day = dayBucket(event.eventTime);
    const week = weekBucket(event.eventTime);

    const now = new Date().toISOString();

    await Promise.all([
      this.updateAggregation(event.driverId, `DAY#${day}`, event.amount, now),
      this.updateAggregation(event.driverId, `WEEK#${week}`, event.amount, now),
    ]);
  }

  public async updateAggregation(
    driverId: string,
    aggregationKey: string,
    amount: number,
    now: string,
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `DRIVER#${driverId}`,
          SK: aggregationKey,
        },
        UpdateExpression: `
          ADD totalAmount :amount
          SET updatedAt = :now,
              createdAt = if_not_exists(createdAt, :now)
        `,
        ExpressionAttributeValues: {
          ":amount": amount,
          ":now": now,
        },
      }),
    );
  }

  async getDailyTotal(
    driverId: string,
    day: string,
  ): Promise<TipAggregation | null> {
    return this.getAggregate(driverId, `DAY#${day}`);
  }

  async getWeeklyTotal(
    driverId: string,
    week: string,
  ): Promise<TipAggregation | null> {
    return this.getAggregate(driverId, `WEEK#${week}`);
  }

  private async getAggregate(
    driverId: string,
    aggregationKey: string,
  ): Promise<TipAggregation | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `DRIVER#${driverId}`,
          SK: aggregationKey,
        },
      }),
    );

    return result.Item ? this.toTipAggregation(result.Item) : null;
  }

  private toTipAggregation(
    item: Record<string, NativeAttributeValue>,
  ): TipAggregation {
    return {
      driverId: item.PK.replace("DRIVER#", "") as string,
      aggregationKey: item.SK as string,
      totalAmount: Number(item.totalAmount ?? 0),
      updatedAt: (item.updatedAt as string) ?? new Date().toISOString(),
    };
  }
}
