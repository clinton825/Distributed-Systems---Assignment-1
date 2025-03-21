/**
 * Lambda handler for retrieving projects by userId with optional filtering
 * Supports filtering by category (using GSI) and completion status
 */
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", JSON.stringify(event));
    
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing userId path parameter" }),
      };
    }

    // Extract query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const { category, completed } = queryParams;
    
    let params: any;
    
    // If category is provided, use the CategoryIndex GSI for efficient filtering
    // This leverages the composite key (userId, category) structure
    if (category) {
      params = {
        TableName: process.env.TABLE_NAME,
        IndexName: "CategoryIndex",
        KeyConditionExpression: "userId = :userId AND category = :category",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":category": category,
        },
      };
    } else {
      // Without category filter, use the base table with userId as the key
      params = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      };
    }
    
    // Add an optional filter for completion status
    // Note: This uses FilterExpression which applies after querying, so less efficient than the GSI approach
    if (completed !== undefined) {
      const isCompleted = completed === "true";
      params.FilterExpression = "completed = :completed";
      params.ExpressionAttributeValues[":completed"] = isCompleted;
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Successfully retrieved projects",
        projects: commandOutput.Items || [],
        count: commandOutput.Count || 0,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Failed to retrieve projects",
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
