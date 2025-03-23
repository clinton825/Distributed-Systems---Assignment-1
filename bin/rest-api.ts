#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../lib/database-stack";
import { LambdaStack } from "../lib/lambda-stack";
import { ApiStack } from "../lib/api-stack";
import { ProjectsApiConstruct } from "../lib/projects-api-construct";

const app = new cdk.App();
const region = "eu-west-1";

// Option 1: Multi-stack architecture
if (app.node.tryGetContext('useMultiStack') === 'true') {
  const databaseStack = new DatabaseStack(app, "ProjectsDatabaseStack", {
    env: { region },
    tableName: "ProjectsTable"
  });

  const lambdaStack = new LambdaStack(app, "ProjectsLambdaStack", {
    env: { region },
    projectsTable: databaseStack.table,
    region,
    enableAutoSeed: true
  });

  new ApiStack(app, "ProjectsApiStack", {
    env: { region },
    lambdaFunctions: lambdaStack.functions,
    apiKeyName: "projects-api-key-v2",
    stageName: "dev"
  });
} 
// Option 2: Custom construct (single stack but using the custom construct)
else {
  const stack = new cdk.Stack(app, "ProjectsStack", {
    env: { region }
  });
  
  new ProjectsApiConstruct(stack, "ProjectsApi", {
    tableName: "ProjectsTable",
    apiKeyName: "projects-api-key-v2",
    stageName: "dev",
    region,
    enableAutoSeed: true
  });
}
