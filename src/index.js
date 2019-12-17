'use strict';

const helper = require('./helper')

class S3EventDeploy {
  constructor(serverless, options) {
    this.serverless = serverless
    this.options = options || {}
    this.commands = {
      s3deploy: {
        lifecycleEvents: ['s3'],
        usage: 'Add lambda notifications to S3 buckets',
        options: {
          'continue-on-error' : {
            usage: 'Can be used to attempt a partial deploy, where not all functions are available/deployed. They will be skipped and not attmepted.'
          },
          help: {
            usage: 'See https://github.com/matt-filion/serverless-put-s3-event for detailed documentation.'
          }
        }
      },
      s3remove: {
        lifecycleEvents: ['remove'],
        usage: 'remove lambda notifications to S3 buckets defined in serverless.yml',
      }
    }

    this.hooks = {
      's3deploy:s3': async () => await helper.putS3NotificationConfigurations(serverless, options),
      's3remove:remove': async () => await helper.removeS3NotificationConfigurations(serverless)
    }
  }
}

module.exports = S3EventDeploy;
