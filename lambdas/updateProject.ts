import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", JSON.stringify(event));
    
    // Extract path parameters
    const userId = event.pathParameters?.userId;
    const projectId = event.pathParameters?.projectId;
    
    if (!userId || !projectId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing required path parameters" }),
      };
    }
    
    // Additional debugging info about the body
    console.log("Body type:", typeof event.body);
    console.log("Body value:", event.body);
    console.log("Body length:", event.body ? event.body.length : 0);
    console.log("Headers:", event.headers);
    console.log("Content-Type header:", event.headers && event.headers['content-type']);
    
    // Check if body exists and has content
    if (!event.body || event.body === '""' || event.body === '' || event.body === '{}') {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ 
          message: "Missing or empty request body",
          bodyType: typeof event.body,
          bodyValue: event.body,
          contentType: event.headers && event.headers['content-type']
        }),
      };
    }

    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      console.log("Parsed request body:", requestBody);
    } catch (error: any) {
      console.error("Error parsing request body:", error);
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ 
          message: "Invalid JSON in request body",
          error: error.message,
          bodyReceived: event.body
        }),
      };
    }
    
    // First, check if the project exists
    const getParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        userId: userId,
        projectId: projectId,
      },
    };
    
    const getResult = await ddbDocClient.send(new GetCommand(getParams));
    
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Project not found" }),
      };
    }
    
    // Prepare update expressions and attribute values
    let updateExpression = "set updatedAt = :updatedAt";
    const expressionAttributeValues: any = {
      ":updatedAt": new Date().toISOString(),
    };
    // Initialize expression attribute names to handle reserved keywords
    const expressionAttributeNames: any = {
      "#updatedAt": "updatedAt"
    };
    
    // Define updateable fields
    const updateableFields = [
      "name", "description", "category", "startDate", "endDate", 
      "budget", "completed", "priority", "tags"
    ];
    
    // Build the update expression for each field in the request body
    let updateCount = 0;
    for (const field of updateableFields) {
      if (requestBody[field] !== undefined) {
        const attributeNamePlaceholder = `#${field}`;
        expressionAttributeNames[attributeNamePlaceholder] = field;
        
        if (updateCount === 0) {
          updateExpression = `set #updatedAt = :updatedAt, ${attributeNamePlaceholder} = :${field}`;
        } else {
          updateExpression += `, ${attributeNamePlaceholder} = :${field}`;
        }
        
        expressionAttributeValues[`:${field}`] = requestBody[field];
        updateCount++;
      }
    }
    
    const updateParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        userId: userId,
        projectId: projectId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW" as const,
    };
    
    console.log("Update params:", JSON.stringify(updateParams, null, 2));
    
    const updateResult = await ddbDocClient.send(new UpdateCommand(updateParams));
    
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Project updated successfully",
        project: updateResult.Attributes,
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
        message: "Failed to update project",
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
