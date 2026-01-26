import type { SQSEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import type { TipRepository } from "./repositories/tip-repository";
import { createTipConsumerHandler } from "./tip-consumer-handler";

function createMockTipRepository(): TipRepository {
  return {
    applyTip: vi.fn(),
    updateAggregation: vi.fn(),
    getDailyTotal: vi.fn(),
    getWeeklyTotal: vi.fn(),
  };
}

function createSQSEvent(
  messages: Array<{ body: string; messageId: string }>,
): SQSEvent {
  return {
    Records: messages.map((msg) => ({
      messageId: msg.messageId,
      receiptHandle: `receipt-${msg.messageId}`,
      body: msg.body,
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: Date.now().toString(),
        SenderId: "test-sender",
        ApproximateFirstReceiveTimestamp: Date.now().toString(),
      },
      messageAttributes: {},
      md5OfBody: "test-md5",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:test-queue",
      awsRegion: "us-east-1",
    })),
  };
}

describe("tip-consumer-handler", () => {
  it("should successfully process valid tip events", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    const handler = createTipConsumerHandler(mockTipRepository);

    const validTipEvent = {
      driverId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 5.5,
      eventTime: new Date().toISOString(),
    };

    const sqsEvent = createSQSEvent([
      {
        messageId: "msg-1",
        body: JSON.stringify(validTipEvent),
      },
    ]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).toHaveBeenCalledTimes(1);
    expect(mockTipRepository.applyTip).toHaveBeenCalledWith(validTipEvent);
    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle invalid JSON in message body", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    const handler = createTipConsumerHandler(mockTipRepository);

    const sqsEvent = createSQSEvent([
      {
        messageId: "msg-1",
        body: "invalid-json{",
      },
    ]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
  });

  it("should handle validation failures", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    const handler = createTipConsumerHandler(mockTipRepository);

    const invalidTipEvent = {
      driverId: "", // Invalid: empty string
      amount: -5, // Invalid: negative amount
      eventTime: "not-a-date", // Invalid: not ISO 8601
    };

    const sqsEvent = createSQSEvent([
      {
        messageId: "msg-1",
        body: JSON.stringify(invalidTipEvent),
      },
    ]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
  });

  it("should handle processing errors", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    mockTipRepository.applyTip = vi
      .fn()
      .mockRejectedValue(new Error("DynamoDB error"));
    const handler = createTipConsumerHandler(mockTipRepository);

    const validTipEvent = {
      driverId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 5.5,
      eventTime: new Date().toISOString(),
    };

    const sqsEvent = createSQSEvent([
      {
        messageId: "msg-1",
        body: JSON.stringify(validTipEvent),
      },
    ]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).toHaveBeenCalledTimes(1);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
  });

  it("should process multiple messages and handle partial failures", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    mockTipRepository.applyTip = vi
      .fn()
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error("Processing error")); // Second fails

    const handler = createTipConsumerHandler(mockTipRepository);

    const validTipEvent1 = {
      driverId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 5.5,
      eventTime: new Date().toISOString(),
    };

    const validTipEvent2 = {
      driverId: "123e4567-e89b-12d3-a456-426614174001",
      amount: 10.0,
      eventTime: new Date().toISOString(),
    };

    const sqsEvent = createSQSEvent([
      {
        messageId: "msg-1",
        body: JSON.stringify(validTipEvent1),
      },
      {
        messageId: "msg-2",
        body: JSON.stringify(validTipEvent2),
      },
    ]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).toHaveBeenCalledTimes(2);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-2" }]);
  });

  it("should handle empty batch", async () => {
    // Arrange
    const mockTipRepository = createMockTipRepository();
    const handler = createTipConsumerHandler(mockTipRepository);

    const sqsEvent = createSQSEvent([]);

    // Act
    const result = await handler(sqsEvent);

    // Assert
    expect(mockTipRepository.applyTip).not.toHaveBeenCalled();
    expect(result.batchItemFailures).toEqual([]);
  });
});
