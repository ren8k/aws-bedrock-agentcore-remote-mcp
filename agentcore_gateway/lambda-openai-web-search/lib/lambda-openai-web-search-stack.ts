import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export class LambdaOpenaiWebSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const layer = new lambda.LayerVersion(this, "DependenciesLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/layers"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            "bash",
            "-c",
            "pip install -r requirements.txt -t /asset-output/python/",
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_13],
    });

    new lambda.Function(this, "OpenAIWebSearchFunction", {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "index.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/src")),
      layers: [layer],
      timeout: cdk.Duration.minutes(10),
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      },
    });
  }
}
