import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * A construct that triggers a Lambda function during stack deployment
 * Used to automatically seed the database with sample data
 */
export class AutoSeedConstruct extends Construct {
  constructor(scope: Construct, id: string, seedFunction: lambda.IFunction) {
    super(scope, id);

    // Create a provider that will execute the seed Lambda
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: seedFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    // Create a custom resource that will trigger on deployment
    new cdk.CustomResource(this, 'SeedingResource', {
      serviceToken: provider.serviceToken,
      // Adding a timestamp ensures this runs on every deployment
      properties: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
