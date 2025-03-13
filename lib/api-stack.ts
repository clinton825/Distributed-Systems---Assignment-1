import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
  lambdaFunctions: {
    getProjectsByUserIdFn: lambdanode.NodejsFunction;
    getProjectByIdFn: lambdanode.NodejsFunction;
    addProjectFn: lambdanode.NodejsFunction;
    updateProjectFn: lambdanode.NodejsFunction;
    deleteProjectFn: lambdanode.NodejsFunction;
    translateProjectFn: lambdanode.NodejsFunction;
  };
  apiKeyName?: string;
  stageName?: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

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

    // Create API key
    this.apiKey = new apigateway.ApiKey(this, "ProjectsApiKey", {
      apiKeyName: props.apiKeyName || "projects-api-key-v2",
      description: "API Key for POST, PUT, and DELETE operations (Multi-Stack)",
      enabled: true,
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
    const projectsResource = this.api.root.addResource("projects");
    
    // GET /projects/{userId} - Get all projects for a user
    const userProjects = projectsResource.addResource("{userId}");
    userProjects.addMethod(
      "GET",
      new apigateway.LambdaIntegration(props.lambdaFunctions.getProjectsByUserIdFn, { proxy: true })
    );

    // GET /projects/{userId}/{projectId} - Get specific project
    const project = userProjects.addResource("{projectId}");
    project.addMethod(
      "GET",
      new apigateway.LambdaIntegration(props.lambdaFunctions.getProjectByIdFn, { proxy: true })
    );

    // POST /projects - Add a new project
    projectsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(props.lambdaFunctions.addProjectFn, { 
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
      new apigateway.LambdaIntegration(props.lambdaFunctions.updateProjectFn, { 
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
      new apigateway.LambdaIntegration(props.lambdaFunctions.deleteProjectFn, { proxy: true }),
      { apiKeyRequired: true } // API key required for DELETE operations
    );

    // GET /projects/{userId}/{projectId}/translate - Translate a project description
    const translateResource = project.addResource("translate");
    translateResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(props.lambdaFunctions.translateProjectFn, { proxy: true })
    );

    // Output the API URL
    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      description: "The URL of the API Gateway",
      exportName: "ProjectsApiUrl",
    });
  }
}
