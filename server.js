var express = require('express');
var https = require("https");
var fse = require("fs-extra");
var bodyParser = require('body-parser');
var uuid = require('uuid');

// INFO

var totalItemsTrained = 0;
var root = __dirname + '/public';
var trainedItems = [];
	
var pathToBrain = root + "/pong/brain.json";
var pathToTraining = root + "/pong/training_data/";
var pathToStats = root + "/pong/stats.json";

function readStats() {
	fse.readFile(pathToStats, function read(err, data) {
		if (err) {
			saveStats({'trainingSize' : 0});
		} else {
			saveStats(JSON.parse(data));
		}
	});
}

function saveStats(stats) {
	stats.trainingSize += totalItemsTrained;
	totalItemsTrained = 0;
	fse.writeFile(pathToStats, JSON.stringify(stats), function(err) {
		if(err) {
			return console.log(err);
		}
		console.log("Stats was saved!");
	});
}

// SET UP SERVER

var app = express();

app.use(express.static(root));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function (req, res) {
	var dest = 'index.html';
	res.sendFile(dest, { root: root + "/pong" });
});
app.get('/get_brain', function (req, res) {
	fse.readFile(pathToBrain, function read(err, data) {
		if (err) {
			res.status(500).send('Error reading brain file');
			console.log(err);
		} else {
			res.end(data);
			console.log('Sent master brain to a client!');
		}
	});
});
app.post('/train', function (req, res) {
	var data = req.body.data;
	var array = JSON.parse(data);
	
	trainedItems = trainedItems.concat(array);
	console.log("I have " + trainedItems.length + " client knowledge so far!");
	
	if (trainedItems.length > 1000) {
		var str = JSON.stringify(trainedItems);
		trainedItems.length = 0;
		fse.writeFile(pathToTraining + uuid.v4() + ".json", str, function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("Training data was saved!");
		});	
	}
	
	totalItemsTrained += array.length;
	readStats();
	
	res.redirect('/get_brain');
});

var privateKey  = fse.readFileSync('sslcert/key.pem', 'utf8');
var certificate = fse.readFileSync('sslcert/cert.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);
httpsServer.listen(process.env.PORT || 3000, function () {
	var host = httpsServer.address().address;
	var port = httpsServer.address().port;

	console.log('AI started at https://%s:%s', host, port);
});