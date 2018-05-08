const Twitter = require('twitter')

// Secret configs for your credentials
require('dotenv').config()
// Config for regular settings
const config = require('config')
const settings = config.get('settings')

module.exports = function(req, res) {
  const request = req.body
  const apiResponse = {}
  
  const twitterClient = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: req.body.consumerSecret,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: req.body.accessTokenSecret,
  })

  twitterClient.get('statuses/user_timeline', {
    screen_name: process.env.SCREEN_NAME,
    count: 200, // Tweets to fetch for potential deletion. Max 200
    exclude_replies: false,
    include_rts: true,
    trim_user: true, // Don't include the full user object, we don't need it
  })
    .then(tweets => {
      if (tweets.length <= settings.desired_max_tweets) {
        return Promise.resolve()
      } else {
        // Factor saved_tweets into the slice of recent tweets that we're saving
        const frontTweetSlice = settings.desired_max_tweets - settings.saved_tweets.length

        const tweetsToDelete = tweets.slice(frontTweetSlice).filter(tweet => !settings.saved_tweets.includes(tweet.id_str))

        const deletePromises = tweetsToDelete.map(tweet => {
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

      return res.send(apiResponse)
    })
    .catch(err => {
      console.error(err)
      return res.status(500).send(err)
    })
}
