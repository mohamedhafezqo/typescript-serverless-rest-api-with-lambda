import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const table = "challenge-cloud-native-driver-mgmt-ts";

export type Driver = {
  id: string;
  firstname: string;
  lastname: string;
  driverLicenseId: string;
};

const toDriver = ({
  id,
  firstname,
  lastname,
  driverLicenseId,
}: Record<string, NativeAttributeValue>): Driver => ({
  id,
  firstname,
  lastname,
  driverLicenseId,
});

export const createDriver = async (driver: Driver): Promise<Driver> => {
  const { id, lastname, driverLicenseId } = driver;

  await dynamo.send(
    new PutCommand({
      TableName: table,
      Item: {
        id,
        lastname,
        driverLicenseId,
      },
    }),
  );

  return driver;
};

export const getDriver = async (driverId: string): Promise<Driver | null> => {
  const { Item } = await dynamo.send(
    new GetCommand({
      TableName: table,
      Key: {
        id: driverId,
      },
    }),
  );

  return Item ? toDriver(Item) : null;
};

export const getDrivers = async (): Promise<Driver[]> => {
  const { Items } = await dynamo.send(
    new ScanCommand({
      TableName: table,
    }),
  );

  return Items ? Items.map((i) => toDriver(i)) : [];
};
