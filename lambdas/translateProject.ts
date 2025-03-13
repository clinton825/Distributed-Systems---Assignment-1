import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const ddbDocClient = createDDbDocClient();
const translateClient = new TranslateClient({ region: process.env.REGION });

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
    
    // Get the target language from query parameters
    const targetLanguage = event.queryStringParameters?.targetLanguage;
    
    if (!targetLanguage) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing targetLanguage query parameter" }),
      };
    }
    
    // First, get the project details
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
    
    const project = getResult.Item;
    
    // Check if the translation for this language already exists
    if (project.translations && project.translations[targetLanguage]) {
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Translation already exists",
          project: {
            ...project,
            translatedDescription: project.translations[targetLanguage],
          },
        }),
      };
    }
    
    // Call Amazon Translate to translate the description
    const translateParams = {
      Text: project.description,
      SourceLanguageCode: "en", // Assuming the source is English
      TargetLanguageCode: targetLanguage,
    };
    
    const translateResult = await translateClient.send(new TranslateTextCommand(translateParams));
    const translatedText = translateResult.TranslatedText;
    
    // Update the project with the new translation
    const translations = project.translations || {};
    translations[targetLanguage] = translatedText;
    
    const updateParams = {
      TableName: process.env.TABLE_NAME,
      Key: {
        userId: userId,
        projectId: projectId,
      },
      UpdateExpression: "set translations = :translations, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":translations": translations,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW" as const,
    };
    
    const updateResult = await ddbDocClient.send(new UpdateCommand(updateParams));
    
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Project translated successfully",
        project: {
          ...updateResult.Attributes,
          translatedDescription: translatedText,
        },
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
        message: "Failed to translate project",
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
