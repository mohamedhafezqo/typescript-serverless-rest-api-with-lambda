import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import type { Driver } from "../models/driver.model";
import type { DriverRepository } from "./driver-repository";

// todo: get the table name from the environment variable
const TABLE_NAME = "challenge-cloud-native-driver-mgmt-ts";

const toDriver = ({
  id,
  firstname,
  lastname,
  driverLicenseId,
}: Record<string, NativeAttributeValue>): Driver => ({
  id: id as string,
  firstname: firstname as string,
  lastname: lastname as string,
  driverLicenseId: driverLicenseId as string,
});

export class DynamoDriverRepository implements DriverRepository {
  private readonly dynamo: DynamoDBDocumentClient;

  constructor(dynamoClient?: DynamoDBDocumentClient) {
    this.dynamo =
      dynamoClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async findById(id: string): Promise<Driver | null> {
    const { Item } = await this.dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      }),
    );

    return Item ? toDriver(Item) : null;
  }

  async create(driver: Driver): Promise<Driver> {
    await this.dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          id: driver.id,
          firstname: driver.firstname,
          lastname: driver.lastname,
          driverLicenseId: driver.driverLicenseId,
        },
      }),
    );

    return driver;
  }

  async findAll(): Promise<Driver[]> {
    const { Items } = await this.dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      }),
    );

    return Items ? Items.map(toDriver) : [];
  }
}
