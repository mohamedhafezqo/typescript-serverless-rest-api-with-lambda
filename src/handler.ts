import { randomUUID } from "node:crypto";
import type { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { createDriver, getDriver } from "./driver";

export const handleCreateDriver = async (
  event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.body == null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "invalid input" }),
    };
  }

  const driver = await createDriver({
    id: randomUUID(),
    ...JSON.parse(event.body),
  });

  return {
    statusCode: 201,
    body: JSON.stringify(driver),
  };
};

export const handleGetDriver = async (
  event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;

  if (id == null) {
    return {
      statusCode: 400,
      body: "path parameter missing",
    };
  }

  const driver = await getDriver(id);

  return {
    statusCode: 200,
    body: JSON.stringify(driver),
  };
};
