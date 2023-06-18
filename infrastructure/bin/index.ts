#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lib from '../lib/';

const app = new cdk.App();
const lambdaEdge = new lib.AssetsNodeLambdaEdgeStack(app, "zenn-cf-resize-node-lambda", lib.assetsLambdaEdgeParams, {env: lib.envUsEast1})
const cloudFront = new lib.CloudFrontAssetsStack(app, "zenn-cf-resize-cloudfront", lib.cfAssetsParams, {env: lib.envApNortheast1})
cloudFront.addDependency(lambdaEdge)
