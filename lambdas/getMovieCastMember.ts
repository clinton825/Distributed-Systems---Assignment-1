import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieCastMemberQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieCastMemberQueryParams"] || {}
);

const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.REGION;

if (!TABLE_NAME) {
  throw new Error("TABLE_NAME environment variable is required");
}

if (!REGION) {
  throw new Error("REGION environment variable is required");
}

const ddbDocClient = createDocumentClient(REGION);

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));
    const queryParams = event.queryStringParameters;
    if (!queryParams) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }

    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["MovieCastMemberQueryParams"],
        }),
      };
    }

    // Type assertion after validation
    const validatedParams = queryParams as MovieCastMemberQueryParams;
    const movieId = parseInt(validatedParams.movieId);
    
    let commandInput: QueryCommandInput = {
      TableName: TABLE_NAME,
    };
    
    if ("roleName" in validatedParams && validatedParams.roleName) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m and begins_with(roleName, :r) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": validatedParams.roleName,
        },
      };
    } else if ("actorName" in validatedParams && validatedParams.actorName) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and begins_with(actorName, :a) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":a": validatedParams.actorName,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };
    }
    
    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );
      
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
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
        message: "Internal server error",
        error: error.message 
      }),
    };
  }
};
  
function createDocumentClient(region: string) {
  const ddbClient = new DynamoDBClient({ region });
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