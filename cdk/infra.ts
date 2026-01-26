import path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  EndpointType,
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction as LambdaFunctionTarget } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Feature flags for controlling resources
    const enableTipConsumer = false; // Set to false to disable SQS tip consumer
    const enableTestDataRules = false; // Set to true to enable test data creation

    const driverTipsQueue = this.createQueue(
      this,
      "driver-tips-event-queue-ts",
    );

    const table = this.createDynamoDbTable(
      this,
      "Driver-mgmt-table",
      "challenge-cloud-native-driver-mgmt-ts",
    );

    // Tips table with composite key (PK, SK)
    const tipsTable = new TableV2(this, "Driver-tips-table", {
      tableName: "challenge-cloud-native-driver-tips-ts",
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: AttributeType.STRING,
      },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY, //for development
    });

    // handler to handle POST request
    const createDriverLambda = this.createLambda(
      this,
      "create-driver-handler",
      "di",
      "handleCreateDriver",
    );
    table.grantReadWriteData(createDriverLambda);

    // handler to proccess GET request
    const getDriverLambda = this.createLambda(
      this,
      "get-driver-handler",
      "di",
      "handleGetDriver",
    );
    table.grantReadWriteData(getDriverLambda); // todo: to grant read only access to the table

    // handler to proccess GET request
    const getDriverTipsLambda = this.createLambda(
      this,
      "get-driver-tips-handler",
      "di",
      "handleGetDriverTips",
    );
    table.grantReadData(getDriverTipsLambda); // // Read-only access to drivers table
    tipsTable.grantReadData(getDriverTipsLambda); // Read-only access to tips table

    // Tip consumer Lambda - processes SQS messages and updates tips table
    const tipConsumerLambda = this.createLambda(
      this,
      "tip-consumer-handler",
      "di",
      "handleTipEvent",
    );
    tipsTable.grantReadWriteData(tipConsumerLambda); // Read/write access to tips table

    // Configure SQS event source for tip consumer
    // Set enableTipConsumer to false to disable message processing
    if (enableTipConsumer) {
      tipConsumerLambda.addEventSource(
        new SqsEventSource(driverTipsQueue, {
          batchSize: 10, // Process up to 10 messages per invocation
          maxBatchingWindow: Duration.seconds(5), // Wait up to 5 seconds to batch messages
        }),
      );
    }

    // handler responsible to generate driver and tip test data
    const createDriverTestDataLambda = this.createLambda(
      this,
      "create-driver-test-data-handler",
      "test-data-handler",
      "handleCreateDriversTestData",
    );
    table.grantReadWriteData(createDriverTestDataLambda);

    // handler responsible to generate tip test data
    const createDriverTipTestDataLambda = this.createLambda(
      this,
      "create-driver-tip-test-data-handler",
      "test-data-handler",
      "handleSampleDriverTippingEvent",
      { DRIVER_TIPS_QUEUE_URL: driverTipsQueue.queueUrl },
    );
    driverTipsQueue.grantSendMessages(createDriverTipTestDataLambda);
    table.grantReadWriteData(createDriverTipTestDataLambda);

    // Schedule Rules use to trigger test data creation for easier integration testing
    // Controlled by enableTestDataRules flag at the top of constructor
    new Rule(this, "test-data-driver-rule", {
      ruleName: "driver-test-data-scheduler-rule",
      enabled: enableTestDataRules,
      targets: [new LambdaFunctionTarget(createDriverTestDataLambda)],
      schedule: Schedule.rate(Duration.minutes(2)),
    });

    new Rule(this, "test-data-tips-rule", {
      ruleName: "tips-test-data-scheduler-rule",
      enabled: enableTestDataRules,
      targets: [new LambdaFunctionTarget(createDriverTipTestDataLambda)],
      schedule: Schedule.rate(Duration.minutes(1)),
    });

    // API GW
    const restApiGw = this.createApiGw(this, "DriverRestApiGw", "DriverApiGw");
    const drivers = restApiGw.root.addResource("drivers");

    drivers.addMethod("POST", new LambdaIntegration(createDriverLambda));

    const driverById = drivers.addResource("{id}");
    driverById.addMethod("GET", new LambdaIntegration(getDriverLambda));

    driverById.addResource("tips").addMethod("GET", new LambdaIntegration(getDriverTipsLambda));
  }

  private createDynamoDbTable = (
    scope: Construct,
    id: string,
    tableName: string,
  ) =>
    new TableV2(scope, id, {
      tableName,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY,
    });

  private createApiGw = (
    scope: Construct,
    id: string,
    restApiName: string,
    stageName = "dev",
  ) => {
    const restApi = new RestApi(scope, id, {
      restApiName,
      deployOptions: {
        stageName,
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
      },
      endpointTypes: [EndpointType.REGIONAL],
    });
    return restApi;
  };

  private createLambda = (
    scope: Construct,
    id: string,
    handlerName: string,
    handler: string,
    additionalEnvironment: { [key: string]: string } = {},
  ): NodejsFunction =>
    new NodejsFunction(scope, id, {
      entry: path.join(__dirname, "../src/", `${handlerName}.ts`),
      handler,
      functionName: `challenge-cloud-native-${id}`,
      bundling: {
        forceDockerBundling: false,
        minify: true,
        sourceMap: true,
        tsconfig: "tsconfig.json",
      },
      runtime: Runtime.NODEJS_24_X,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      environment: {
        STAGE: "dev",
        NODE_OPTIONS: "--enable-source-maps",
        ...additionalEnvironment,
      },
    });

  private createQueue = (scope: Construct, name: string): Queue =>
    new Queue(scope, name, {
      queueName: name,
      encryption: QueueEncryption.KMS_MANAGED,
      visibilityTimeout: Duration.seconds(180), // 6x Lambda timeout to prevent duplicate processing
    });
}
