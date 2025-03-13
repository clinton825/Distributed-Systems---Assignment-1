import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ProjectsApiProps {
  tableName?: string;
  apiKeyName?: string;
  stageName?: string;
  region?: string;
}

export class ProjectsApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly table: dynamodb.Table;
  public readonly apiKey: apigateway.ApiKey;
  public readonly getProjectsByUserIdFn: lambdanode.NodejsFunction;
  public readonly getProjectByIdFn: lambdanode.NodejsFunction;
  public readonly addProjectFn: lambdanode.NodejsFunction;
  public readonly updateProjectFn: lambdanode.NodejsFunction;
  public readonly deleteProjectFn: lambdanode.NodejsFunction;
  public readonly translateProjectFn: lambdanode.NodejsFunction;

  constructor(scope: Construct, id: string, props: ProjectsApiProps = {}) {
    super(scope, id);

    const region = props.region || "eu-west-1";
    
    // Create DynamoDB Table
    this.table = new dynamodb.Table(this, "ProjectsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: props.tableName || "Projects",
    });
    
    // Add GSI for querying by category
    this.table.addGlobalSecondaryIndex({
      indexName: "CategoryIndex",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "category", type: dynamodb.AttributeType.STRING },
    });
    
    // Create API key
    this.apiKey = new apigateway.ApiKey(this, "ProjectsApiKey", {
      apiKeyName: props.apiKeyName || "projects-api-key-v2",
      description: "API Key for POST and PUT operations (Custom Construct)",
      enabled: true,
    });

    // Create Lambda functions
    this.getProjectsByUserIdFn = new lambdanode.NodejsFunction(
      this,
      "GetProjectsByUserIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getProjectsByUserId.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    this.getProjectByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetProjectByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getProjectById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    this.addProjectFn = new lambdanode.NodejsFunction(
      this,
      "AddProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/addProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    this.updateProjectFn = new lambdanode.NodejsFunction(
      this,
      "UpdateProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    this.deleteProjectFn = new lambdanode.NodejsFunction(
      this,
      "DeleteProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/deleteProject.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    this.translateProjectFn = new lambdanode.NodejsFunction(
      this,
      "TranslateProjectFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/translateProject.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        environment: {
          TABLE_NAME: this.table.tableName,
          REGION: region,
        },
      }
    );

    // Grant permission for Lambda to use Amazon Translate service
    const translatePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["translate:TranslateText"],
      resources: ["*"]
    });
    this.translateProjectFn.addToRolePolicy(translatePolicy);

    // Grant permissions to Lambda functions
    this.table.grantReadData(this.getProjectsByUserIdFn);
    this.table.grantReadData(this.getProjectByIdFn);
    this.table.grantReadWriteData(this.addProjectFn);
    this.table.grantReadWriteData(this.updateProjectFn);
    this.table.grantReadWriteData(this.translateProjectFn);
    this.table.grantReadWriteData(this.deleteProjectFn);
    
    // Create API Gateway
    this.api = new apigateway.RestApi(this, "ProjectsAPI", {
      description: "Projects API",
      deployOptions: {
        stageName: props.stageName || "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date", "x-api-key"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });
    
    // API Usage Plan with API Key
    const usagePlan = this.api.addUsagePlan("ProjectsApiUsagePlan", {
      name: "ProjectsApiUsagePlan",
      throttle: {
        rateLimit: 10,
        burstLimit: 5,
      },
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });
    
    // Associate the API key with the usage plan
    usagePlan.addApiKey(this.apiKey);

    // Set up API Gateway endpoints
    this.setupApiEndpoints();
  }

  private setupApiEndpoints() {
    // API Gateway Integration
    const projectsResource = this.api.root.addResource("projects");
    
    // GET /projects/{userId} - Get all projects for a user
    const userProjects = projectsResource.addResource("{userId}");
    userProjects.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.getProjectsByUserIdFn, { proxy: true })
    );

    // GET /projects/{userId}/{projectId} - Get specific project
    const project = userProjects.addResource("{projectId}");
    project.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.getProjectByIdFn, { proxy: true })
    );

    // POST /projects - Add a new project
    projectsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(this.addProjectFn, { 
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
      new apigateway.LambdaIntegration(this.updateProjectFn, { 
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
      new apigateway.LambdaIntegration(this.deleteProjectFn, { proxy: true }),
      { apiKeyRequired: true } // API key required for DELETE operations
    );

    // GET /projects/{userId}/{projectId}/translate - Translate a project description
    const translateResource = project.addResource("translate");
    translateResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(this.translateProjectFn, { proxy: true })
    );
  }
}
