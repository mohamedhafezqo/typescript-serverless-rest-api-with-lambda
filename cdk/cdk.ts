import { App } from "aws-cdk-lib";

import { InfraStack } from "./infra";

const app = new App();
const serviceName = "coding-challenge";
new InfraStack(app, `${serviceName}-infra-stack`);
