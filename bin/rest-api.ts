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
  // Create database stack first
  const databaseStack = new DatabaseStack(app, "ProjectsDatabaseStack", {
    env: { region },
    tableName: "ProjectsTable"
  });

  // Create lambda stack with reference to database
  const lambdaStack = new LambdaStack(app, "ProjectsLambdaStack", {
    env: { region },
    projectsTable: databaseStack.table,
    region
  });

  // Create API stack with reference to lambda functions
  new ApiStack(app, "ProjectsApiStack", {
    env: { region },
    lambdaFunctions: lambdaStack.functions,
    apiKeyName: "projects-api-key-v2",
    stageName: "dev"
  });
} 
// Option 2: Custom construct (single stack but using the custom construct)
else {
  // Create a single stack with our custom construct
  const stack = new cdk.Stack(app, "ProjectsStack", {
    env: { region }
  });
  
  // Use our custom construct within the stack
  new ProjectsApiConstruct(stack, "ProjectsApi", {
    tableName: "ProjectsTable",
    apiKeyName: "projects-api-key-v2",
    stageName: "dev",
    region
  });
}
