# serverless-s3-event
The serverless framework makes it easy to push NotificationConfiguration into an existing S3 bucket.


## Installation
```bash
$ npm i serverless-s3-event
```

add the plugin to serverless.yml
```yaml
# serverless.yml
plugins:
  - serverless-s3-event
```

## Configuration

```yaml
custom:
  BucketConfigurations:
    - BucketName: ${env:BUCKET_NAME}
      NotificationConfiguration:
        LambdaFunctionConfigurations:
          - Id: ${env:EVENT_NAME}
            LambdaFunctionArn: ${env:LAMBDA_ARN}
            Events:
              - s3:ObjectCreated:Put
            Filter:
              Key:
                FilterRules:
                  - Name: Suffix
                    Value: .jpg
        TopicConfigurations:
          - Id: ${env:EVENT_NAME}
            TopicArn: ${env:TOPIC_ARN}
            Events:
              - s3:ObjectCreated:Put
            Filter:
              Key:
                FilterRules:
                  - Name: Suffix
                    Value: .gif
        QueueConfigurations:
          - Id: ${env:EVENT_NAME}
            QueueArn: ${env:QUEUE_ARN}
            Events:
              - s3:ObjectCreated:Put
            Filter:
              Key:
                FilterRules:
                  - Name: Suffix
                    Value: .gif
```

## Usage

```bash
# deploy bucket notification configurations
sls s3deploy 
```
```bash
# The force option removes events with a matching event type and suffix. (prefix not supported)
sls s3deploy --force
```
```bash
# The remove command deletes events with id that match the resource recorded in the custom in serverless.yaml
sls s3remove --force
```
