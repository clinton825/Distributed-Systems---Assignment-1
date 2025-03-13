import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", JSON.stringify(event));
    
    // Additional debugging info about the body
    console.log("Body type:", typeof event.body);
    console.log("Body value:", event.body);
    console.log("Body length:", event.body ? event.body.length : 0);
    
    // Check if body exists, has content, and try to handle different API Gateway formats
    if (!event.body || event.body === '""' || event.body === '' || event.body === '{}') {
      // For debugging: log more details about the event
      console.log("No valid body found in event. Event keys:", Object.keys(event));
      console.log("Headers:", event.headers);
      console.log("Content-Type header:", event.headers && event.headers['content-type']);
      
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ 
          message: "Missing or empty request body",
          eventType: typeof event,
          eventKeys: Object.keys(event),
          bodyType: typeof event.body,
          bodyValue: event.body,
          contentType: event.headers && event.headers['content-type']
        }),
      };
    }

    // Parse the request body
    const requestBody = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ["userId", "name", "description", "category", "startDate", "endDate", "budget", "priority"];
    for (const field of requiredFields) {
      if (!requestBody[field]) {
        return {
          statusCode: 400,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ message: `Missing required field: ${field}` }),
        };
      }
    }

    // Generate a unique project ID if not provided
    const projectId = requestBody.projectId || uuidv4();
    
    // Prepare timestamp fields
    const timestamp = new Date().toISOString();
    
    // Create the project item
    const project = {
      userId: requestBody.userId,
      projectId: projectId,
      name: requestBody.name,
      description: requestBody.description,
      category: requestBody.category,
      startDate: requestBody.startDate,
      endDate: requestBody.endDate,
      budget: requestBody.budget,
      completed: requestBody.completed || false,
      priority: requestBody.priority,
      tags: requestBody.tags || [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: project,
      // Ensure the project doesn't already exist with this userId and projectId
      ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(projectId)",
    };

    await ddbDocClient.send(new PutCommand(params));

    return {
      statusCode: 201,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Project created successfully",
        project: project,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);
    
    // Handle conditional check failure (project already exists)
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "A project with this userId and projectId already exists",
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Failed to create project",
        errorMsg: error.message,
        errorStack: error.stack,
      }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
