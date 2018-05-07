const ApiBuilder = require('claudia-api-builder')
const api = new ApiBuilder()

const Twitter = require('twitter')

const config = {
  users: {
    'ryangiglio': {
      'pubConsumerKey': 'Z0OU2aUDhp28JZv2bUi7GkmqV',
      'pubAccessKey': '80357329-0MDUrTFElev4RPzt78pLGb1HDRigeEI3bZHPy4OoQ',
    },
    'ericlimer': {
      'pubConsumerKey': 'w5kaJObZxOSkoa70Bl3y3DLPy',
      'pubAccessKey': '18549180-wUQSYAEysNh8c7szNbfakqiZfC4NVOrJCkOZpzq1I',
    },
  },
}

api.post('/trimTwitterTimeline', function (request) {
  const apiResponse = {}

  const requestBody = request.body
  
  // If the user exists
  if (config.users.hasOwnProperty(requestBody.screen_name)) {
    const userSettings = config.users[requestBody.screen_name]

    const twitterClient = new Twitter({
      consumer_key: userSettings.pubConsumerKey,
      consumer_secret: requestBody.secretConsumerKey,
      access_token_key: userSettings.pubAccessKey,
      access_token_secret: requestBody.secretAccessKey,
    })

    return twitterClient.get('statuses/user_timeline', {
      screen_name: requestBody.screen_name,
      count: 200, // 200 is the max
      exclude_replies: false,
      include_rts: true,
    })
      .then(tweets => {
        const maxTweets = requestBody.maxTweets || 50

        if (tweets.length <= maxTweets) {
          return Promise.resolve()
        } else {
          const tweetsToDelete = tweets.slice(maxTweets)

          // TODO: make savedTweets optional
          const deletePromises = tweetsToDelete.filter(tweet => !requestBody.savedTweets.includes(tweet.id_str)).map(tweet => {
            return new Promise((resolve, reject) => {
              twitterClient.post(`statuses/destroy/${tweet.id_str}`, (err, returnedTweet, response) => {
                if (err) {
                  const errCode = err[0].code

                  switch (errCode) {
                    case 34:
                      // No status found with that ID
                      // Corresponds with HTTP 404. The requested Tweet ID is not found (if it existed, it was probably deleted)
                      return resolve(returnedTweet)

                      break;

                    case 88:
                      // Rate limit exceeded
                      // The request limit for this resource has been reached for the current rate limit window.
                      return reject('ERROR: Twitter API rate limit exceeded')

                      break;
                    case 144:
                      // No status found with that ID
                      // Corresponds with HTTP 404. The requested Tweet ID is not found (if it existed, it was probably deleted)
                      return resolve(returnedTweet)

                      break;
                    case 179:
                      // Sorry, you are not authorized to see this status
                      // Corresponds with HTTP 403. Thrown when a Tweet cannot be viewed by the authenticating user, usually due to the Tweet’s author having protected their Tweets.
                      return resolve(returnedTweet)

                      break;
                    default:
                      return reject('ERROR: Unhandled error')

                      break;
                  }
                } else {
                  if (response.statusCode === 200) {
                    resolve(returnedTweet)
                  } else {
                    reject(`ERROR: Tweet ${returnedTweet.id_str} not deleted`)
                  }
                }
              })
            })
          })

          return Promise.all(deletePromises)
        }
      })
      .then((deletedTweets = []) => {
        // If any tweets were deleted
        if (deletedTweets.length) {
          apiResponse.code = 200
          apiResponse.message = deletedTweets
        } else {
          apiResponse.code = 200
          apiResponse.message = 'No tweets deleted, maxTweets not reached'
        }

        console.log(apiResponse)

        return new api.ApiResponse(apiResponse.message, {}, apiResponse.code)
      })
      .catch(err => {
        console.log(err)

        return new api.ApiResponse(err, {}, 500)
      })
  } else {
    apiResponse.code = 403
    apiResponse.message = 'Access denied. User not configured.'

    console.log(apiResponse)

    return new api.ApiResponse(JSON.stringify(apiResponse), {}, 403)
  }
})

module.exports = api
