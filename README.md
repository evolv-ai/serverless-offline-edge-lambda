serverless-offline-edge-lambda
=================================
A plugin for the [Serverless Framework](https://serverless.com/framework/) that simulates
the behavior of AWS CloudFront Edge Lambdas while developing offline.

### Setup

```bash
npm install --save-dev serverless
npm install --save-dev serverless-offline-edge-lambda
```

_serverless.yml_
```yaml
service:
  name: edge-lambdas
  
plugins:
  - serverless-offline-edge-lambda

provider:
  name: aws
  runtime: nodejs12.x

functions:
  lambda:
    handler: src/handlers.onViewerRequest
    lambdaAtEdge:
      distribution: 'WebsiteDistribution'
      eventType: 'viewer-request'
      pathPattern: '/lambda'

resources:
  Resources:
    WebsiteDistribution:
      Type: 'AWS::CloudFront::Distribution'
      Properties:
        DistributionConfig:
          DefaultCacheBehavior:
```

```bash
npx serverless offline start --port=<port>
```

#### Use with `serverless-offline`
The plugin should not be used in conjunction with `serverless-offline` because both plugins define the `offline` command.

#### Use with `serverless-plugin-cloudfront-lambda-edge`
This plugin does not handle packaging and deploying edge lambdas to the cloud. Therefore
this plugin can be used with `serverless-plugin-cloudfront-lambda-edge`. Again, doing so
is optional. The schema in _serverless.yml_ derives from that used by `serverless-plugin-cloudfront-lambda-edge`.

#### Use with Transpilers
This plugin can also be used with transpilers such as `serverless-plugin-typescript`. In the
cases where the transpiler outputs built files to a path that differs from the path
specified for the handlers (e.g. _.build/src/handers.onViewerRequest_), this plugin accepts
a configuration option `path` that it uses to resolve function handlers.

```yaml
plugins:
  - serverless-plugin-typescript
    
custom:
  offlineEdgeLambda:
    path: '.build'
```

For usage with `serverless-webpack` and `serverless-bundle` the config is similar but the build path changes.
```yaml
plugins:
  - serverless-webpack # or serverless-bundle
  
custom:
  offlineEdgeLambda:
    path: './.webpack/service/'
```
