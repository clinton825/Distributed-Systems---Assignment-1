/**
 * Seeds DynamoDB with project data during CloudFormation stack deployment
 * 
 * This Lambda is triggered by a Custom Resource and leverages AWS SDK v3
 * to perform batch writes to DynamoDB in chunks (respecting DynamoDB's 25-item limit)
 */
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { projects } from "../seed/projects";

// Initialize DynamoDB client with configured marshalling options
const ddbDocClient = createDDbDocClient();

/**
 * Lambda handler for CloudFormation Custom Resource
 * Handles Create/Update events by seeding data and Delete events by returning success
 */
export const handler = async (event: CloudFormationCustomResourceEvent): Promise<any> => {
  try {
    console.log("Event:", JSON.stringify(event));
    
    if (event.RequestType === "Delete") {
      await sendResponse(event, "SUCCESS", { Message: "Delete request handled successfully" });
      return;
    }
    
    const tableName = process.env.TABLE_NAME;
    const batchItems: Array<{ PutRequest: { Item: any } }> = [];
    
    for (const project of projects) {
      batchItems.push({
        PutRequest: {
          Item: project
        }
      });
    }
    
    // Split into chunks of 25 items to respect DynamoDB batch write limits
    const batchChunks: Array<Array<{ PutRequest: { Item: any } }>> = [];
    for (let i = 0; i < batchItems.length; i += 25) {
      batchChunks.push(batchItems.slice(i, i + 25));
    }
    
    for (const chunk of batchChunks) {
      const params = {
        RequestItems: {
          [tableName!]: chunk
        }
      };
      
      await ddbDocClient.send(new BatchWriteCommand(params));
    }
    
    console.log(`Seeded ${projects.length} projects into table ${tableName}`);
    
    await sendResponse(event, "SUCCESS", { Message: `Seeded ${projects.length} projects successfully` });
  } catch (error: any) {
    console.error("Error:", error);
    await sendResponse(event, "FAILED", { Message: `Failed to seed projects: ${error.message}` });
  }
};

// Valid status values for CloudFormation Custom Resource responses
type CloudFormationStatus = "SUCCESS" | "FAILED";

/**
 * Sends response back to CloudFormation
 * CloudFormation Custom Resources require responses to be sent to a pre-signed URL
 */
async function sendResponse(event: CloudFormationCustomResourceEvent, status: CloudFormationStatus, data: any) {
  const responseBody: CloudFormationCustomResourceResponse = {
    Status: status,
    Reason: "See the details in CloudWatch Log Stream",
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  };

  console.log("Response Body:\n", JSON.stringify(responseBody));

  const https = require("https");
  const url = require("url");
  
  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "content-type": "",
      "content-length": JSON.stringify(responseBody).length,
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response: any) => {
      console.log(`Status code: ${response.statusCode}`);
      resolve(null);
    });

    request.on("error", (error: any) => {
      console.log(`Send response failed: ${error}`);
      reject(error);
    });

    request.write(JSON.stringify(responseBody));
    request.end();
  });
}

/**
 * Creates a DynamoDB Document client with optimized marshalling options
 * - Removes undefined values to prevent errors
 * - Converts empty values for compatibility
 * - Ensures proper number handling
 */
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
