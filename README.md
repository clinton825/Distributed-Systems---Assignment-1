# Project Info API - Distributed System Assignment 1
A serverless REST API for managing projects, built using AWS CDK with TypeScript.

## 🌟 Overview

This API provides endpoints for creating, retrieving, updating, deleting, and translating project data using a flexible architecture that demonstrates two advanced AWS CDK patterns: custom constructs and multi-stack deployments.

**Developed by:** Clinton Bempah  
**Student ID:** 20097793  

## Features

- **Project Management**: Create, read, update, and delete projects.
- **Filtering**: Filter projects by category and completion status.
- **Security**: API key authentication for POST, PUT, and DELETE operations.
- **Translation**: Translate project descriptions using Amazon Translate.
- **Advanced Architecture**: Implements both custom constructs and a multi-stack approach.

## Architecture

### 1. Custom Construct Pattern

A reusable `ProjectsApiConstruct` encapsulates:
- DynamoDB table for project storage.
- Lambda functions for all operations.
- API Gateway with endpoints and method configurations.
- API Key authentication for secured operations.

### 2. Multi-Stack Pattern

The application is divided into three separate stacks:
- **DatabaseStack**: Contains DynamoDB resources.
- **LambdaStack**: Contains Lambda functions with database references.
- **ApiStack**: Contains API Gateway with Lambda references.

### AWS Services Used

- **AWS CDK**: Infrastructure as Code.
- **AWS Lambda**: Serverless compute functions.
- **Amazon DynamoDB**: NoSQL database for project storage.
- **Amazon API Gateway**: REST API endpoints.
- **Amazon Translate**: Machine translation for project descriptions.

## Database Design

The DynamoDB table has a composite key structure with a global secondary index:

- **Partition Key**: `userId` (Identifies project owner)
- **Sort Key**: `projectId` (Unique project identifier)
- **GSI**: `CategoryIndex` (For querying projects by category)

### Project Attributes

- `userId`: Owner of the project.
- `projectId`: Unique ID (auto-generated UUID).
- `name`: Project name.
- `description`: Detailed project description.
- `category`: Project category.
- `startDate`: Project start date.
- `endDate`: Project end date.
- `budget`: Budget allocated.
- `completed`: Boolean flag for completion status.
- `priority`: Priority level.
- `tags`: Array of associated tags.
- `createdAt`: Timestamp when created.
- `updatedAt`: Timestamp when last updated.

## API Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | /projects/{userId} | Get all projects for a user | No |
| GET | /projects/{userId}?category={category}&completed={true/false} | Filter projects | No |
| GET | /projects/{userId}/{projectId} | Get a specific project | No |
| POST | /projects | Create a new project | API Key |
| PUT | /projects/{userId}/{projectId} | Update a project | API Key |
| DELETE | /projects/{userId}/{projectId} | Delete a project | API Key |
| GET | /projects/{userId}/{projectId}/translate?language={lang} | Translate project description | No |

## Getting Started

### Prerequisites

- Node.js and npm
- AWS CDK toolkit
- AWS CLI configured with credentials

### Installation

```bash
npm install
```

### Deployment Options

#### Option 1: Deploy using Custom Construct (default)
```bash
cdk deploy ProjectsStack
```

#### Option 2: Deploy using Multi-Stack Architecture
```bash
cdk deploy --context useMultiStack=true --all
```

### Seeding Data
After deployment, you'll need to seed the database with sample projects:

#### For Custom Construct deployment:
```bash
aws lambda invoke --function-name ProjectsStack-SeedProjectsFn --payload '{}' response.json
```

#### For Multi-Stack deployment:
```bash
aws lambda invoke --function-name ProjectsLambdaStack-SeedProjectsFn --payload '{}' response.json
```

This will populate your DynamoDB table with sample projects defined in `seed/projects.ts`.

## API Key Authentication

Protected endpoints (POST, PUT, DELETE) require an API key in the request header:

```
x-api-key: YOUR_API_KEY
```

## Implementation Notes

### Custom Construct Implementation

The custom construct encapsulates all resources needed for the API:

```typescript
new ProjectsApiConstruct(stack, "ProjectsApi", {
  tableName: "ProjectsTable",
  apiKeyName: "projects-api-key-v2",
  stageName: "dev",
  region: "eu-west-1"
});
```

### Multi-Stack Implementation

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

