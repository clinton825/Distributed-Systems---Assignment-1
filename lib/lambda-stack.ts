import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

// Create a shared Lambda layer for common utilities
const createLambdaLayer = (scope: Construct, id: string) => {
  return new lambda.LayerVersion(scope, id, {
    code: lambda.Code.fromAsset('layers/utils'),
    compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    description: 'Common utilities for Lambda functions',
  });
};

export interface LambdaStackProps extends cdk.StackProps {
  projectsTable: dynamodb.Table;
  region?: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly functions: {
    getProjectsByUserIdFn: lambdanode.NodejsFunction;
    getProjectByIdFn: lambdanode.NodejsFunction;
    addProjectFn: lambdanode.NodejsFunction;
    updateProjectFn: lambdanode.NodejsFunction;
    deleteProjectFn: lambdanode.NodejsFunction;
    translateProjectFn: lambdanode.NodejsFunction;
  };

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const region = props.region || "eu-west-1";
    
    // Create a shared utilities layer
    // Note: This will require creating a 'layers/utils' directory with shared code
    // For now we'll create the layer reference but comment out its usage
    // const utilsLayer = createLambdaLayer(this, 'ProjectsUtilsLayer');

    // Create Lambda functions
    const getProjectsByUserIdFn = new lambdanode.NodejsFunction(
      this,
      "GetProjectsByUserIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getProjectsByUserId.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer], // Uncomment when you add the utils layer
      }
    );

    const getProjectByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetProjectByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getProjectById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer],
      }
    );

    const addProjectFn = new lambdanode.NodejsFunction(
      this,
      "AddProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/addProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer],
      }
    );

    const updateProjectFn = new lambdanode.NodejsFunction(
      this,
      "UpdateProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer],
      }
    );

    const deleteProjectFn = new lambdanode.NodejsFunction(
      this,
      "DeleteProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/deleteProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer],
      }
    );

    const translateProjectFn = new lambdanode.NodejsFunction(
      this,
      "TranslateProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/translateProject.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        environment: {
          TABLE_NAME: props.projectsTable.tableName,
          REGION: region,
        },
        // layers: [utilsLayer],
      }
    );

    // Grant permission for Lambda to use Amazon Translate service
    const translatePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["translate:TranslateText"],
      resources: ["*"]
    });
    translateProjectFn.addToRolePolicy(translatePolicy);

    // Grant permissions to Lambda functions
    props.projectsTable.grantReadData(getProjectsByUserIdFn);
    props.projectsTable.grantReadData(getProjectByIdFn);
    props.projectsTable.grantReadWriteData(addProjectFn);
    props.projectsTable.grantReadWriteData(updateProjectFn);
    props.projectsTable.grantReadWriteData(translateProjectFn);
    props.projectsTable.grantReadWriteData(deleteProjectFn);

    // Export function names and ARNs
    new cdk.CfnOutput(this, "GetProjectsByUserIdFunctionArn", {
      value: getProjectsByUserIdFn.functionArn,
      exportName: "GetProjectsByUserIdFunctionArn",
    });

    new cdk.CfnOutput(this, "GetProjectByIdFunctionArn", {
      value: getProjectByIdFn.functionArn,
      exportName: "GetProjectByIdFunctionArn",
    });

    // Store references to all functions
    this.functions = {
      getProjectsByUserIdFn,
      getProjectByIdFn,
      addProjectFn,
      updateProjectFn,
      deleteProjectFn,
      translateProjectFn,
    };
  }
}
