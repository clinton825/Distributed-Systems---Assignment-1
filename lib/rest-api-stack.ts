import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for Projects with composite key (userId, projectId)
    const projectsTable = new dynamodb.Table(this, "ProjectsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Projects",
    });

    // Create a GSI for querying by category
    projectsTable.addGlobalSecondaryIndex({
      indexName: "CategoryIndex",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "category", type: dynamodb.AttributeType.STRING },
    });

    // API key for authentication
    const apiKey = new apigateway.ApiKey(this, "ProjectsApiKey", {
      apiKeyName: "projects-api-key",
      description: "API Key for POST and PUT operations",
      enabled: true,
    });

    // Create Lambda functions
    
    // 1. Get Projects by userId (Collection endpoint)
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // 2. Get Project by userId and projectId (Single item endpoint)
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // 3. Create new project (POST)
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // 4. Update Project (PUT)
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // 5. Delete Project function
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // 6. Translate project description
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
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // Grant permission for Lambda to use Amazon Translate service
    const translatePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["translate:TranslateText"],
      resources: ["*"]
    });
    translateProjectFn.addToRolePolicy(translatePolicy);

    // 6. Seed Projects function
    const seedProjectsFn = new lambdanode.NodejsFunction(
      this,
      "SeedProjectsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/seedProjects.ts`,
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
        environment: {
          TABLE_NAME: projectsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // Grant permissions to Lambda functions
    projectsTable.grantReadData(getProjectsByUserIdFn);
    projectsTable.grantReadData(getProjectByIdFn);
    projectsTable.grantReadWriteData(addProjectFn);
    projectsTable.grantReadWriteData(updateProjectFn);
    projectsTable.grantReadWriteData(translateProjectFn);
    projectsTable.grantReadWriteData(deleteProjectFn);
    projectsTable.grantReadWriteData(seedProjectsFn);

    // Custom resource to seed data
    const seedDataProvider = new custom.Provider(this, "SeedDataProvider", {
      onEventHandler: seedProjectsFn,
    });

    new cdk.CustomResource(this, "SeedDataResource", {
      serviceToken: seedDataProvider.serviceToken,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, "ProjectsAPI", {
      description: "Projects API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date", "x-api-key"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // API Usage Plan with API Key
    const usagePlan = api.addUsagePlan("ProjectsApiUsagePlan", {
      name: "ProjectsApiUsagePlan",
      throttle: {
        rateLimit: 10,
        burstLimit: 5,
      },
    });

    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });
    
    // Associate the API key with the usage plan
    usagePlan.addApiKey(apiKey);

    // API Gateway Integration
    const projectsResource = api.root.addResource("projects");
    
    // GET /projects/{userId} - Get all projects for a user
    const userProjects = projectsResource.addResource("{userId}");
    userProjects.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProjectsByUserIdFn, { proxy: true })
    );

    // GET /projects/{userId}/{projectId} - Get specific project
    const project = userProjects.addResource("{projectId}");
    project.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProjectByIdFn, { proxy: true })
    );

    // POST /projects - Add a new project
    projectsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(addProjectFn, { 
        proxy: true,
        // Explicitly configure request parameters
        requestParameters: {
          "integration.request.header.Content-Type": "'application/json'"
        },
        // Explicitly set passthrough behavior
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES
      }),
      { apiKeyRequired: true } // API key required for POST operations
    );

    // PUT /projects/{userId}/{projectId} - Update a project
    project.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(updateProjectFn, { 
        proxy: true,
        // Explicitly configure request parameters
        requestParameters: {
          "integration.request.header.Content-Type": "'application/json'"
        },
        // Explicitly set passthrough behavior
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES
      }),
      { apiKeyRequired: true } // API key required for PUT operations
    );

    // DELETE /projects/{userId}/{projectId} - Delete a project
    project.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(deleteProjectFn, { proxy: true }),
      { apiKeyRequired: true } // API key required for DELETE operations
    );

    // GET /projects/{userId}/{projectId}/translate - Translate a project description
    const translateResource = project.addResource("translate");
    translateResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(translateProjectFn, { proxy: true })
      // Removed API key requirement for testing
    );
  }
}