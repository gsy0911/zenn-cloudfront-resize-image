import {
  Stack,
  StackProps,
  aws_lambda,
  Duration,
  aws_iam,
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {XRegionParam} from './XRegionParam';
import {prefix} from './common';
import * as path from "path";
import {PythonFunction} from '@aws-cdk/aws-lambda-python-alpha';


export interface IAssetsLambdaEdgeStack {
  s3BucketName: string
}

const registerFunction = (params: {constructor: Stack, func: aws_lambda.Function, cfType: "viewer-request" | "origin-response", language: "node" | "python"}) => {
  new aws_lambda.Alias(params.constructor, `alias-${params.cfType}`, {
    aliasName: 'latest',
    version: params.func.currentVersion,
  })
  new XRegionParam(params.constructor, `x-region-param-${params.cfType}`, {
    region: "ap-northeast-1"
  }).putSsmParameter({
    parameterName: `/${prefix}/assets-stack/lambda-edge/${params.language}/${params.cfType}`,
    parameterValue: `${params.func.functionArn}:${params.func.currentVersion.version}`,
    parameterDataType: "text",
    idName: `x-region-params-${params.language}-${params.cfType}`
  })

}

/**
 * imagesなどのデータを保存するCloudFrontスタック
 */
export class AssetsNodeLambdaEdgeStack extends Stack {

  constructor(scope: Construct, id: string, params: IAssetsLambdaEdgeStack, props?: StackProps) {
    super(scope, id, props);

    const role = new aws_iam.Role(this, 'lambdaRole', {
      roleName: "image-edge-node-role",
      assumedBy: new aws_iam.CompositePrincipal(
        new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
        new aws_iam.ServicePrincipal('edgelambda.amazonaws.com'),
      ),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'cloudwatch', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
      ],
      inlinePolicies: {
        "accessS3": new aws_iam.PolicyDocument({
          statements: [
            new aws_iam.PolicyStatement({
              effect: aws_iam.Effect.ALLOW,
              resources: [
                `arn:aws:s3:::${params.s3BucketName}/*`,
                `arn:aws:s3:::${params.s3BucketName}`,
              ],
              actions: ['s3:*']
            })
          ]
        })
      }
    })

    const dir = path.resolve(__dirname, 'lambda', 'image_resize_node')
    const viewerRequestCommand = ["bash", "-c", [
      `cp viewer_request.js package.json /asset-output`,
      "cd /asset-output",
      "npm install querystring --production --prefix .",
    ].join(" && ")]
    const edgeViewerRequest = new aws_lambda.Function(this, "edge-viewer-request", {
      code: aws_lambda.Code.fromAsset(dir, {
        bundling: {
          image: aws_lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: viewerRequestCommand,
          user: "root"
        }
      }),
      functionName: `image-viewer-request-node`,
      handler: `viewer_request.handler`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: Duration.seconds(5),
      architecture: aws_lambda.Architecture.X86_64,
      role,
    })
    registerFunction({
      constructor: this,
      func: edgeViewerRequest,
      cfType: "viewer-request",
      language: "node",
    })
    const originResponseCommand = ["bash", "-c", [
      `cp origin_response.js package.json /asset-output`,
      "cd /asset-output",
      "npm install querystring --production --prefix .",
      "npm install aws-sdk --production --prefix .",
      // arm環境でビルドするとsharpがエラーを吐くため、x64でインストールするようにする
      "npm install sharp --arch=x64 --platform=linux --production --prefix .",
    ].join(" && ")]
    const edgeOriginResponse = new aws_lambda.Function(this, "edge-origin-response", {
      code: aws_lambda.Code.fromAsset(dir, {
        bundling: {
          image: aws_lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: originResponseCommand,
          user: "root"
        }
      }),
      functionName: `image-origin-response-node`,
      handler: `origin_response.handler`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      memorySize: 512,
      timeout: Duration.seconds(20),
      architecture: aws_lambda.Architecture.X86_64,
      role,
    })
    registerFunction({
      constructor: this,
      func: edgeOriginResponse,
      cfType: "origin-response",
      language: "node",
    })
  }
}


export class AssetsPythonLambdaEdgeStack extends Stack {

  constructor(scope: Construct, id: string, params: IAssetsLambdaEdgeStack, props?: StackProps) {
    super(scope, id, props);

    const role = new aws_iam.Role(this, 'lambdaRole', {
      roleName: "image-edge-python-role",
      assumedBy: new aws_iam.CompositePrincipal(
        new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
        new aws_iam.ServicePrincipal('edgelambda.amazonaws.com'),
      ),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'cloudwatch', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
      ],
      inlinePolicies: {
        "accessS3": new aws_iam.PolicyDocument({
          statements: [
            new aws_iam.PolicyStatement({
              effect: aws_iam.Effect.ALLOW,
              resources: [
                `arn:aws:s3:::${params.s3BucketName}/*`,
                `arn:aws:s3:::${params.s3BucketName}`,
              ],
              actions: ['s3:*']
            })
          ]
        })
      }
    })
    const edgeViewerRequest = new PythonFunction(this, 'edge-python-viewer-request', {
      functionName: "image-viewer-request-python",
      entry: './lib/lambda/image_resize_python/viewer_request',
      index: 'handler.py',
      handler: 'handler',
      runtime: aws_lambda.Runtime.PYTHON_3_9,
      timeout: Duration.seconds(5),
      memorySize: 128,
      role: role
    })
    registerFunction({
      constructor: this,
      func: edgeViewerRequest,
      cfType: "viewer-request",
      language: "python",
    })

    const edgeOriginResponse = new PythonFunction(this, 'edge-python-origin-response', {
      functionName: "image-origin-response-python",
      entry: './lib/lambda/image_resize_python/origin_response',
      index: 'handler.py',
      handler: 'handler',
      runtime: aws_lambda.Runtime.PYTHON_3_9,
      timeout: Duration.seconds(30),
      memorySize: 512,
      role: role
    })
    registerFunction({
      constructor: this,
      func: edgeOriginResponse,
      cfType: "origin-response",
      language: "python",
    })
  }
}
