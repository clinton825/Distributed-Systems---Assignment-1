import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * A CDK construct that triggers a Lambda function during CloudFormation stack deployment
 * 
 * This construct uses CloudFormation Custom Resources to execute a seeding function
 * exactly once during deployment. The timestamp property ensures the resource
 * is updated on each deployment, forcing the Lambda to run each time.
 */
export class AutoSeedConstruct extends Construct {
  constructor(scope: Construct, id: string, seedFunction: lambda.IFunction) {
    super(scope, id);

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: seedFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    new cdk.CustomResource(this, 'SeedingResource', {
      serviceToken: provider.serviceToken,
      properties: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
