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
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const driverTipsQueue = this.createQueue(
      this,
      "driver-tips-event-queue-ts",
    );

    const table = this.createDynamoDbTable(
      this,
      "Driver-mgmt-table",
      "challenge-cloud-native-driver-mgmt-ts",
    );

    // handler to handle POST request
    const createDriverLambda = this.createLambda(
      this,
      "create-driver-handler",
      "handler",
      "handleCreateDriver",
    );
    table.grantReadWriteData(createDriverLambda);

    // handler to proccess GET request
    const getDriverLambda = this.createLambda(
      this,
      "get-driver-handler",
      "handler",
      "handleGetDriver",
    );
    table.grantReadWriteData(getDriverLambda);

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
    // change enabled to true to switch on test data creation
    new Rule(this, "test-data-driver-rule", {
      ruleName: "driver-test-data-scheduler-rule",
      enabled: false,
      targets: [new LambdaFunctionTarget(createDriverTestDataLambda)],
      schedule: Schedule.rate(Duration.minutes(2)),
    });

    new Rule(this, "test-data-tips-rule", {
      ruleName: "tips-test-data-scheduler-rule",
      enabled: false, // set to true when needed to generate tips
      targets: [new LambdaFunctionTarget(createDriverTipTestDataLambda)],
      schedule: Schedule.rate(Duration.minutes(1)),
    });

    // API GW
    const restApiGw = this.createApiGw(this, "DriverRestApiGw", "DriverApiGw");
    const drivers = restApiGw.root.addResource("drivers");

    drivers.addMethod("POST", new LambdaIntegration(createDriverLambda));

    drivers
      .addResource("{id}")
      .addMethod("GET", new LambdaIntegration(getDriverLambda));
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
    });
}
