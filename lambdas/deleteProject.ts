import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", event);
    
    // Get userId and projectId from path parameters
    const userId = event.pathParameters?.userId;
    const projectId = event.pathParameters?.projectId;

    if (!userId || !projectId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing required path parameters: userId and projectId",
        }),
      };
    }

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        userId: userId,
        projectId: projectId,
      },
      // Ensure the item exists before deleting
      ConditionExpression: "attribute_exists(userId) AND attribute_exists(projectId)",
    };

    await ddbDocClient.send(new DeleteCommand(params));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Project deleted successfully",
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);
    
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Project not found",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Failed to delete project",
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
