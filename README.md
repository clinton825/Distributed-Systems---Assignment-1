# Serverless REST Assignment - Distributed Systems.

__Name:__ Clinton Bempah (20097793)

__Demo:__ [Link to YouTube demonstration]

### Context.

Context: Project Management

Table item attributes:
+ userId - string (Partition key)
+ projectId - string (Sort Key)
+ name - string
+ description - string
+ category - string
+ startDate - string
+ endDate - string
+ budget - number
+ completed - boolean
+ priority - string
+ tags - List<string>
+ createdAt - string
+ updatedAt - string
+ translations - Map<string, string> (Optional)

### App API endpoints.

+ GET /projects/{userId} - Get all projects for a user
+ GET /projects/{userId}?category={category}&completed={true/false} - Filter projects by category and completion status
+ GET /projects/{userId}/{projectId} - Get a specific project by ID
+ POST /projects - Create a new project.
+ PUT /projects/{userId}/{projectId} - Update an existing project.
+ DELETE /projects/{userId}/{projectId} - Delete a project.
+ GET /projects/{userId}/{projectId}/translate?language={lang} - Translate project description to specified language

### Features.

#### Translation persistence 

When a project description is translated via the translate endpoint, the translation is stored in the project's DynamoDB item under a 'translations' map attribute. Each translation is stored with the language code as the key and the translated text as the value. This allows for quick retrieval of previously translated content without calling the Amazon Translate service repeatedly for the same language.

Example structure of a project item with translations:

+ userId - string (Partition key)
+ projectId - string (Sort Key)
+ name - string
+ description - string (original language)
+ category - string
+ translations - Map<string, string>
  + "fr": "[French translation of the description]"
  + "es": "[Spanish translation of the description]"
  + "de": "[German translation of the description]"

#### Custom L2 Construct (completed)

The custom L2 construct (`ProjectsApiConstruct`) provisions all necessary infrastructure for the projects API including: DynamoDB table, Lambda functions, API Gateway with endpoints, and API key authentication.

Construct Input props object:
~~~ts
export interface ProjectsApiProps {
  tableName?: string;
  apiKeyName?: string;
  stageName?: string;
  region?: string;
  enableAutoSeed?: boolean;
}
~~~

Construct public properties:
~~~ts
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
  public readonly seedProjectsFn: lambdanode.NodejsFunction;
}
~~~

#### Multi-Stack app (completed)

The application can be deployed using a multi-stack architecture which separates concerns into three independent stacks:

1. **DatabaseStack**: Contains the DynamoDB table with the appropriate partition key, sort key, and global secondary index configurations
2. **LambdaStack**: Contains all Lambda functions needed for CRUD operations and translation, with references to the database resources
3. **ApiStack**: Contains the API Gateway configuration with endpoints, methods, and API key setup, with references to the Lambda functions

This architecture allows for more granular control over deployments and updates, as well as better separation of concerns.


#### API Keys. (completed)

The application implements API key authentication to protect sensitive endpoints (POST, PUT, DELETE) from unauthorized access. This is done by creating an API key in API Gateway and requiring it for specific methods.

~~~ts
// Create API key
this.apiKey = new apigateway.ApiKey(this, "ProjectsApiKey", {
  apiKeyName: props.apiKeyName || "projects-api-key-v2",
  description: "API Key for POST and PUT operations",
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

// Requiring API key for specific methods
projectsResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(this.addProjectFn, { proxy: true }),
  { apiKeyRequired: true } // API key required for POST operations
);
~~~

###  Extra 

The project includes an extensive seed data function that populates the DynamoDB table with 24 diverse projects across 10 different categories (Industrial, Commercial & Retail, Residential, Healthcare, Educational, Infrastructure, Mixed-Use, Recreation, Transportation, Sustainable/Green), providing a comprehensive dataset for testing and demonstration purposes.

The multi-stack approach separates concerns into discrete stacks:

```typescript
const dbStack = new DatabaseStack(app, "ProjectsDatabaseStack", {...});
const lambdaStack = new LambdaStack(app, "ProjectsLambdaStack", {
  projectsTable: dbStack.projectsTable,
  ...
});
const apiStack = new ApiStack(app, "ProjectsApiStack", {
  lambdaFunctions: lambdaStack.functions,
  ...
});
```

## 💡 How to Contribute

1. Fork the repository.
2. Create a new branch (`feature-branch-name`).
3. Commit your changes.
4. Submit a pull request for review.

---

