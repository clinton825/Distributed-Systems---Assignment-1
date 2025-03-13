import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface DatabaseStackProps extends cdk.StackProps {
  tableName?: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    // Create DynamoDB Table
    this.table = new dynamodb.Table(this, "ProjectsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: props?.tableName || "Projects",
    });
    
    // Add GSI for querying by category
    this.table.addGlobalSecondaryIndex({
      indexName: "CategoryIndex",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "category", type: dynamodb.AttributeType.STRING },
    });

    // Output the table name and ARN
    new cdk.CfnOutput(this, "ProjectsTableName", {
      value: this.table.tableName,
      description: "The name of the projects table",
      exportName: "ProjectsTableName",
    });

    new cdk.CfnOutput(this, "ProjectsTableArn", {
      value: this.table.tableArn,
      description: "The ARN of the projects table",
      exportName: "ProjectsTableArn",
    });
  }
}
