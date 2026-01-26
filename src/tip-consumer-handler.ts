import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { TipEvent } from "./models/tip-event.model";
import type { TipRepository } from "./repositories/tip-repository";
import { TipEventSchema } from "./schemas/tip-event.schema";

/**
 * Handler factory for dependency injection
 */
export const createTipConsumerHandler = (tipRepository: TipRepository) => {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: Array<{ itemIdentifier: string }> = [];

    // Step 1: Parse SQS event structure - iterate over Records
    for (const record of event.Records) {
      const messageId = record.messageId;

      try {
        // Step 2: Parse message body JSON
        let tipEventData: unknown;
        try {
          tipEventData = JSON.parse(record.body);
        } catch (parseError) {
          console.error(
            `Failed to parse JSON for message ${messageId}:`,
            parseError,
          );
          batchItemFailures.push({ itemIdentifier: messageId });
          continue;
        }

        // Step 3: Validate tip event structure
        const validationResult = TipEventSchema.safeParse(tipEventData);
        if (!validationResult.success) {
          console.error(
            `Validation failed for message ${messageId}:`,
            validationResult.error.issues,
          );
          batchItemFailures.push({ itemIdentifier: messageId });
          continue;
        }

        const tipEvent: TipEvent = validationResult.data;

        // Step 4: Process valid events - call tipRepository.applyTip()
        try {
          await tipRepository.applyTip(tipEvent);
          console.log(
            `Successfully processed tip event for driver ${tipEvent.driverId}, amount: ${tipEvent.amount}`,
          );
        } catch (processingError) {
          console.error(
            `Failed to process tip event for message ${messageId}:`,
            processingError,
          );
          batchItemFailures.push({ itemIdentifier: messageId });
        }
      } catch (error) {
        // Catch any unexpected errors
        console.error(
          `Unexpected error processing message ${messageId}:`,
          error,
        );
        batchItemFailures.push({ itemIdentifier: messageId });
      }
    }

    return {
      batchItemFailures,
    };
  };
};
