import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { projects } from "../seed/projects";

const ddbDocClient = createDDbDocClient();

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<any> => {
  try {
    console.log("Event:", JSON.stringify(event));
    
    // Only process Create and Update events
    if (event.RequestType === "Delete") {
      await sendResponse(event, "SUCCESS", { Message: "Delete request handled successfully" });
      return;
    }
    
    // Prepare the items for batch write
    const tableName = process.env.TABLE_NAME;
    const batchItems: Array<{ PutRequest: { Item: any } }> = [];
    
    // Add each project to the batch
    for (const project of projects) {
      batchItems.push({
        PutRequest: {
          Item: project
        }
      });
    }
    
    // DynamoDB batch write can only process 25 items at a time
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

type CloudFormationStatus = "SUCCESS" | "FAILED";

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
