import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { handleGetDriver } from "./handler";

describe("handler", () => {
  it("get driver should return bad request when id parameter missing", async () => {
    const response = await handleGetDriver(
      {} as unknown as APIGatewayProxyEvent,
    );
    expect(response.statusCode).toBe(400);
  });

  it("get driver should return not found when driver not found", async () => {
    const response = await handleGetDriver({
      pathParameters: {
        id: "i-do-not-exist",
      },
    } as unknown as APIGatewayProxyEvent);
    expect(response.statusCode).toBe(404);
  });
});
