import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDriverRepository } from "./repositories/dynamo-driver-repository";
import { DynamoTipRepository } from "./repositories/dynamo-tip.repository";
import { DriverService } from "./services/driver.service";

const sqs = new SQSClient({});

// Create shared DynamoDB client (can be reused across repositories)
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Initialize repositories (direct instantiation)
const driverRepository = new DynamoDriverRepository(dynamoClient);
const tipRepository = new DynamoTipRepository(dynamoClient);

// Initialize services (direct instantiation)
const driverService = new DriverService(driverRepository, tipRepository);

// handler generating driver test data when table is empty
export const handleCreateDriversTestData = async (): Promise<void> => {
  const drivers = await driverService.getDrivers();

  if (drivers.length === 0) {
    console.log(`creating test data`);
    await driverService.createDriver({
      firstname: "Linda",
      lastname: "Doe",
      driverLicenseId: "12345",
    });

    await driverService.createDriver({
      firstname: "Dean",
      lastname: "Driver",
      driverLicenseId: "9654321",
    });
  } else {
    console.log(
      `skipping test data creation ${drivers.length} drivers exist already`,
    );
  }
};

// handler generating driver tip test data
export const handleSampleDriverTippingEvent = async (): Promise<void> => {
  const drivers = await driverService.getDrivers();
  const queueUrl = process.env.DRIVER_TIPS_QUEUE_URL;

  if (drivers.length > 0 && queueUrl) {
    const body = {
      driverId: drivers[Math.floor(Math.random() * drivers.length)].id,
      amount: (Math.random() * 10).toFixed(2),
      eventTime: new Date().toISOString(),
    };

    console.log(`sending sample tipping event ${JSON.stringify(body)}`);

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
      }),
    );
  }
};
