import { IAssetsLambdaEdgeStack } from './LambdaEdgeStack'
import { ICfAssetsStack } from './CloudFrontAssetsStack';
import { Environment } from 'aws-cdk-lib';

const accountId: string = "000011112222"
const s3BucketName: string = "your-buket"

export const cfAssetsParams: ICfAssetsStack = {
  cloudfront: {
    certificate: "arn:aws:acm:us-east-1:000011112222:certificate/aaaabbbb-cccc-dddd-eeee-ffffgggghhhh",
    route53DomainName: "your.domain.com",
    route53RecordName: "record.your.domain.com",
    s3BucketName,
  }
}

export const assetsLambdaEdgeParams: IAssetsLambdaEdgeStack = {
  s3BucketName
}

export const envApNortheast1: Environment = {
  account: accountId,
  region: "ap-northeast-1"
}

export const envUsEast1: Environment = {
  account: accountId,
  region: "us-east-1"
}
