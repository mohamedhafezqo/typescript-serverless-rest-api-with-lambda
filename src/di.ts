import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createHandlers } from "./handler";
import { DynamoDriverRepository } from "./repositories/dynamo-driver-repository";
import { DynamoTipRepository } from "./repositories/dynamo-tip.repository";
import { DriverService } from "./services/driver.service";
import { createTipConsumerHandler } from "./tip-consumer-handler";

// Create shared DynamoDB client (can be reused across repositories)
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Initialize repositories (direct instantiation)
const driverRepository = new DynamoDriverRepository(dynamoClient);
const tipRepository = new DynamoTipRepository(dynamoClient);

// Initialize services (direct instantiation)
const driverService = new DriverService(driverRepository, tipRepository);

// Initialize handlers
const handlers = createHandlers(driverService);
const tipConsumerHandler = createTipConsumerHandler(tipRepository);

// Export handlers for Lambda
export const handleCreateDriver = handlers.handleCreateDriver;
export const handleGetDriver = handlers.handleGetDriver;
export const handleGetDriverTips = handlers.handleGetDriverTips;
export const handleTipEvent = tipConsumerHandler;
