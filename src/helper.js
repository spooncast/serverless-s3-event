const AWS = require('aws-sdk')
const chalk = require('chalk')
const _ = require('lodash')

// lodash mixin
const objMap = (collection, iteratee) => {
  if (!iteratee) return
  const keyByMap = (collection, iteratee) => {
    return _.chain(collection)
      .map((item, key) => ({ item: iteratee(item, key), key }))
      .keyBy('key').mapValues('item').value()
  }
  fn = collection.constructor === Object ? keyByMap : _.map
  return fn(collection, iteratee)
}
 
const objFilter = (collection, iteratee) => { 
  if (!iteratee) return
  const keyByFilter = (collection, iteratee) => {
    return _.chain(collection)
      .map((item, key) => ({ item: item, key }))
      .filter(({item, key}) => iteratee(item, key))
      .keyBy('key').mapValues('item').value()
  }
  fn = collection.constructor === Object ? keyByFilter : _.filter
  return fn(collection, iteratee)
}

_.mixin( { objMap })
_.mixin( { objFilter })

const getS3Client = (serverless) => {
  const provider = serverless.getProvider('aws')
  const awsCredentials = provider.getCredentials()
  const s3 = new AWS.S3({ credentials: awsCredentials.credentials })
  return s3
}

const getOriginList = async (putConfiguration, serverless) => {
  const bucketName = putConfiguration.BucketName 
  const s3 = getS3Client(serverless)
  const originList = await s3.getBucketNotificationConfiguration({ Bucket: bucketName }).promise()
  return originList
}

const removeS3Event = (originList, putConfiguration, options, serverless) => {
  const cliLog = (msg) => serverless.cli.consoleLog(`Serverless: ${msg}`)
  const additionalNotificationConfiguration = putConfiguration.NotificationConfiguration
  const isForce = options.force ? true : false

  const addList = _.chain(additionalNotificationConfiguration)
    .map((additionalConfigurations, additionalConfigurationsKey) => {
      return _.map(additionalConfigurations, additionalConfiguration => {
        return { key: additionalConfigurationsKey, value: additionalConfiguration}
      })
    }).flatten().value()
  const comparisonList = _.map(addList, addItem => {
    const events = addItem.value.Events
    let suffix
    if (addItem.value.Filter) {
      suffix = _.chain(addItem.value.Filter.Key.FilterRules)
        .filter(rule => rule.Name === 'Suffix')
        .map(rule => rule.Value).value()[0]
    }
    return { events, suffix }
  })
  // remove same id
  const filteredListBySameId = _.objMap(originList, (configurations) => {
    return _.objFilter(configurations, (configuration) => {
      const isSame = addList.map(addItem => addItem.value.Id).includes(configuration.Id)
      if (isSame) cliLog(chalk.yellow(`remove NotificationConfiguration ${configuration.Id}`))
      return !isSame
    })
  })
  // force remove
  const removeEventAndSuffix = (list) => {
    return _.objMap(list, (configurations) => {
      return _.objFilter(configurations, (configuration) => {
        const filteredConfiguration = _.objFilter(comparisonList, comparisonItem => {
          const isMatchedEvent = _.objFilter(comparisonItem.events, event => configuration.Events.includes(event)).length > 0

          let configurationSuffix
          let isMatchedSuffix
          if (configuration.Filter) {
            configurationSuffix = _.chain(configuration.Filter.Key.FilterRules)
              .filter(rule => rule.Name === 'Suffix')
              .map(rule => rule.Value).value()[0]
            isMatchedSuffix = comparisonItem.suffix === configurationSuffix
                || comparisonItem.suffix === undefined
                || configurationSuffix === undefined
          } else {
            isMatchedSuffix = true
          }
          const isMatched = isMatchedEvent && isMatchedSuffix
          if (isMatched) cliLog(chalk.yellow(`remove NotificationConfiguration ${configuration.Id}`))
          return isMatched
        })
        return filteredConfiguration.length === 0
      })
    })
  }
  const removedList = isForce ? removeEventAndSuffix(filteredListBySameId) : filteredListBySameId
  return removedList
}

const pushNotification = (filteredList, putConfiguration) => {
  const _filteredList = JSON.parse(JSON.stringify(filteredList))
  const additionalNotificationConfiguration = putConfiguration.NotificationConfiguration

  const addList = _.chain(additionalNotificationConfiguration)
  .map((additionalConfigurations, additionalConfigurationsKey) => {
    return _.map(additionalConfigurations, additionalConfiguration => {
      return { key: additionalConfigurationsKey, value: additionalConfiguration}
    })
  }).flatten().value()

  _.map(addList, addItem => _filteredList[addItem.key].push(addItem.value))
  return _filteredList
}

const putS3Event = async (originList, putConfiguration, serverless) => {
  const s3 = getS3Client(serverless)
  const bucketName = putConfiguration.BucketName
  const params = { Bucket: bucketName, NotificationConfiguration: originList }
  await s3.putBucketNotificationConfiguration(params).promise()
}

const putS3NotificationConfigurations = async (serverless, options) => {
  if (!serverless.service.custom || !serverless.service.custom.BucketConfigurations) {
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`Not found BucketConfigurations`)}`)
  }
  const custom = serverless.service.custom
  const bucketConfigurations = custom.BucketConfigurations
  const promiseTask = _.map(bucketConfigurations, async putConfiguration => {
    const originList = await getOriginList(putConfiguration, serverless)
    const removedList = removeS3Event(originList, putConfiguration, options, serverless)
    const putList = pushNotification(removedList, putConfiguration)
    return putS3Event(putList, putConfiguration, serverless)
  })
  try {
    await Promise.all(promiseTask)
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`put NotificationConfiguration success`)}`)
  } catch (e) {
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`put NotificationConfiguration fail (${e})`)}`)
  }
}

const removeS3NotificationConfigurations = async (serverless) => {
  if (!serverless.service.custom || !serverless.service.custom.BucketConfigurations) {
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`Not found BucketConfigurations`)}`)
  }
  const custom = serverless.service.custom
  const bucketConfigurations = custom.BucketConfigurations
  const promiseTask = _.map(bucketConfigurations, async putConfiguration => {
    const originList = await getOriginList(putConfiguration, serverless)
    const removedList = removeS3Event(originList, putConfiguration, {}, serverless)
    return putS3Event(removedList, putConfiguration, serverless)
  })
  try {
    await Promise.all(promiseTask)
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`remove NotificationConfiguration success`)}`)
  } catch (e) {
    serverless.cli.consoleLog(`Serverless: ${chalk.yellow(`remove NotificationConfiguration fail (${e})`)}`)
  }
}

module.exports = {
  putS3NotificationConfigurations,
  removeS3NotificationConfigurations
}