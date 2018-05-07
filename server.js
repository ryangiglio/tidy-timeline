// server.js
// where your node app starts

// init project
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const trimTweetsHandler = require('./handlers/trimTweets')

app.use(express.static('public'))
app.use(bodyParser.json())

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/trimTweets', trimTweetsHandler)

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port)
})
