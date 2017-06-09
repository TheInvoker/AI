var express = require('express');
var https = require("https");
var fse = require("fs-extra");
var synaptic = require('synaptic');
var bodyParser = require('body-parser');

// INFO

var totalItemsTrained = 0;
var root = __dirname + '/public';
	
// SET UP NEURAL NETS

var learningRate = .3;
var pathToBrain = root + "/pong/brain.json";
var pathToStats = root + "/pong/stats.json";
var myNetwork;

var Neuron = synaptic.Neuron;
var Layer = synaptic.Layer;
var Network = synaptic.Network;

fse.exists(pathToBrain, function(exists) {
    if (exists) {
		fse.readFile(pathToBrain, function read(err, data) {
			if (err) {
				throw console.log(err);
			}
			
			var brainExtract = JSON.parse(data);
			myNetwork = Network.fromJSON(brainExtract);
			console.log("Loaded brain!");
			
			runSave();
			setUpServer();
			runStats();
		});
    } else {
		console.log("Creating brain!");
		
		var inputLayer = new Layer(21);
		var hiddenLayer = new Layer(22);
		var outputLayer = new Layer(1);

		inputLayer.project(hiddenLayer);
		hiddenLayer.project(outputLayer);

		myNetwork = new Network({
			input: inputLayer,
			hidden: [hiddenLayer],
			output: outputLayer
		});
		
		hiddenLayer.neurons().map(function(x) { x.squash = Neuron.squash.TANH; });
		
		runSave();
		setUpServer();
		runStats();
	}
});



// SAVE BRAIN

function runSave() {
	setInterval(function() {
		var brainExtract = JSON.stringify(myNetwork.toJSON());
		fse.writeFile(pathToBrain, brainExtract, function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("Brain was saved!");
		});
	}, 1000 * 60);
}






// SAVE STATS

function runStats() {
	setInterval(readStats, 1000 * 60);
}

function readStats() {
	fse.readFile(pathToStats, function read(err, data) {
		if (err) {
			saveStats({'trainingSize' : 0});
		} else {
			data = data.toString();
			console.log(data);
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

function setUpServer() {
	var app = express();

	app.use(express.static(root));
	app.use(bodyParser.urlencoded({ extended: false }));

	app.get('/', function (req, res) {
		var dest = 'index.html';
		res.sendFile(dest, { root: root + "/pong" });
	});
	app.post('/get_brain', function (req, res) {
		res.end(JSON.stringify(myNetwork.toJSON()));
		console.log('Sent master brain to a client!');
	});
	app.post('/train_and_get_brain', function (req, res) {
		var data = req.body.data;
		var array = JSON.parse(data);
		for(var i=0; i<array.length; i+=1) {
			var item = array[i];
			myNetwork.activate(item[0]);
			myNetwork.propagate(learningRate, item[1]);
		}
		totalItemsTrained += array.length;
		console.log('Trained on client knowledge! ' + array.length + ' items');
		res.end(JSON.stringify(myNetwork.toJSON()));
		console.log('Sent master brain to a client!');
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
}