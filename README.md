# Coding Challenge

Driver Management Service

## Introduction

This repository contains a service managing drivers.
The initial version contains REST endpoints to get and create drivers.

The service is implemented in `Typescript` running on `AWS Lambda`.
The [AWS CDK](https://aws.amazon.com/cdk/) is used to describe and deploy it.
You can find the infrastructure-related code in the [cdk folder](./cdk/).

The service uses a `DynamoDb` table to store the driver master data.

## Deploy and run

First make sure the dependencies are installed.

```sh
npm run install
```

Afterwards you can deploy the service.

```sh
npm run bootstrap # only once per account

npm run deploy
```

Now you should be able to interact with the REST API of the service.
The API endpoints can be found in the output that `yarn deploy` produces.

```sh
curl -X POST https://<your-api-id>.execute-api.eu-central-1.amazonaws.com/dev/drivers -d '{"firstname": "Some", "lastname": "One", "driverLicenseId": "4711"}'

curl  https://<your-api-id>.execute-api.eu-central-1.amazonaws.com/dev/drivers/ff79773c-0bf7-46ac-aeda-441f700580d4
```

## Task Specification

We want to add the functionality of **driver tipping** to our system.
Other services have already implemented the feature of accepting tips from a customer and also paying out tips to the driver.

We now want to add functionality to our system to be able to show the driver the amount of tips received.

Thus our driver service **should now keep track of the tips a driver received** and offer an API to access this data.
It should be extended to be able to **aggregate the tips** received **by each driver on a weekly and daily level**.

The tipping events are available via the [SQS](https://aws.amazon.com/de/sqs/) queue `driver-tips-event-queue-ts`.
These events contain information about the driver receiving the tip and the amount tipped.

```ts
{
    "driverId": "275d7bb8-3a2f-432c-8435-5a01c64ca6ba",
    "amount": "7.33"
    "eventTime": "2019-09-16T10:58:14.651Z"
}
```

The function [`handleSampleDriverTippingEvent`](cdk/infra.ts#L67) can be used to send a test message to the queue.
Uncomment the scheduler event to run the function every minute.

**Your task is to:**

- consume tipping events and store the information in a suitable way. It would be great if you could explain shortly why you decided for your strategy to store the tips (and which alternatives you discarded).
- extend the REST API of the service by an endpoint which exposes the aggregated amount of tips received by a specific driver today and in the current week.
- the previous developers struggled to write unit tests for the handlers. The data access is in our way. Maybe you can help us out here and make the handlers testable.
- improve the quality of the existing code and adapt it to your needs. The existing code definitely has a few flaws. **The complete code you hand in should meet your own quality standards.**

**Please also provide a few sentences regarding the decisions you made and the reasoning behind them.**
It might happen that you cannot reach the solution you envision e.g. because of time constraints or lack of technology skills. This is fine - please leave a few sentences explaining the envisioned solution.

**NOTE on AI usage:**
AI is part of the modern toolbox and we are open to its use @ MOIA. Feel free to use it as you see fit while solving this challenge. 

## Clean up

To remove the traces of this application on your AWS account make sure you clean up after you finished:

```sh
npm run destroy
```
