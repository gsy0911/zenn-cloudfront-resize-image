import {
  Stack,
  StackProps,
  aws_s3,
  aws_lambda,
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_certificatemanager as aws_acm,
  aws_route53,
  aws_route53_targets,
  aws_ssm,
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {prefix} from './common';


export interface ICfAssetsStack {
  cloudfront: {
    /** us-east-1のACMのARN*/
    certificate: `arn:aws:acm:us-east-1:${string}:certificate/${string}`
    s3BucketName: string
    route53DomainName: string
    route53RecordName: string
  }
}

/**
 * imagesなどのデータを保存するCloudFrontスタック
 */
export class CloudFrontAssetsStack extends Stack {

  constructor(scope: Construct, id: string, params: ICfAssetsStack, props?: StackProps) {
    super(scope, id, props);

    // Lambda@Edgeの参照
    const viewerRequestVersionParam = aws_ssm.StringParameter.fromStringParameterAttributes(this, 'viewer-request-param', {
      parameterName: `/${prefix}/assets-stack/lambda-edge/node/viewer-request`,
    }).stringValue;
    const originResponseVersionParam = aws_ssm.StringParameter.fromStringParameterAttributes(this, 'origin-response-param', {
      parameterName: `/${prefix}/assets-stack/lambda-edge/node/origin-response`,
    }).stringValue;
    const edgeViewerRequestVersion = aws_lambda.Version.fromVersionArn(this, "viewer-request-version", viewerRequestVersionParam)
    const edgeOriginResponseVersion = aws_lambda.Version.fromVersionArn(this, "origin-response-version", originResponseVersionParam)

    // CloudFrontの引数など
    const s3Bucket = aws_s3.Bucket.fromBucketName(this, "sources3", params.cloudfront.s3BucketName)
    const certificate = aws_acm.Certificate.fromCertificateArn(this, "virginiaCertificate", params.cloudfront.certificate)
    const distribution = new aws_cloudfront.Distribution(this, "assets-web-distribution", {
      defaultBehavior: {
        origin: new aws_cloudfront_origins.S3Origin(s3Bucket),
        edgeLambdas: [
          {
            functionVersion: edgeViewerRequestVersion,
            eventType: aws_cloudfront.LambdaEdgeEventType.VIEWER_REQUEST
          },
          {
            functionVersion: edgeOriginResponseVersion,
            eventType: aws_cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE
          }
        ],
        originRequestPolicy: new aws_cloudfront.OriginRequestPolicy(this, "origin-request-policy", {
          originRequestPolicyName: "origin-response-policy",
          queryStringBehavior: aws_cloudfront.OriginRequestQueryStringBehavior.all()
        }),
        viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new aws_cloudfront.CachePolicy(this, "cache-policy", {
          cachePolicyName: "cache-policy",
          queryStringBehavior: aws_cloudfront.CacheQueryStringBehavior.allowList("w", "h", "fit", "extension", "quality")
        })

      },
      defaultRootObject: "index.html",
      certificate: certificate,
      domainNames: [params.cloudfront.route53RecordName],
      sslSupportMethod: aws_cloudfront.SSLMethod.SNI,
      minimumProtocolVersion: aws_cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
    })

    // Route 53 from cloudfront
    const cloudfrontHostedZone = aws_route53.HostedZone.fromLookup(this, "cloudfront-hosted-zone", {
      domainName: params.cloudfront.route53DomainName
    })
    new aws_route53.ARecord(this, "cloudfront-a-record", {
      zone: cloudfrontHostedZone,
      recordName: params.cloudfront.route53RecordName,
      target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.CloudFrontTarget(distribution))
    })
  }
}
