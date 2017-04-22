var express = require('express');
var https = require("https");
var fse = require("fs-extra");
var synaptic = require('synaptic');

// SET UP SERVER

var app = express();
var root = __dirname + '/public';

app.use(express.static(root));

app.get('/', function (req, res) {
	var dest = 'index.html';
	res.sendFile(dest, { root: root + "/pong" });
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

// SET UP NEURAL NETS

var learningRate = .3;
var pathToBrain = root + "/pong/brain.json";
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
			setUpSockets();
		});
    } else {
		console.log("Creating brain!");
		
		var inputLayer = new Layer(2);
		var hiddenLayer = new Layer(3);
		var hiddenLayer2 = new Layer(3);
		var outputLayer = new Layer(1);

		inputLayer.project(hiddenLayer);
		hiddenLayer.project(hiddenLayer2);
		hiddenLayer2.project(outputLayer);

		myNetwork = new Network({
			input: inputLayer,
			hidden: [hiddenLayer, hiddenLayer2],
			output: outputLayer
		});
		
		hiddenLayer.neurons().map(function(x) { x.squash = Neuron.squash.TANH; });
		hiddenLayer2.neurons().map(function(x) { x.squash = Neuron.squash.TANH; });
		
		runSave();
		setUpSockets();
	}
});

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


// INFO

var totalItemsTrained = 0;

// SET UP SOCKETS

function setUpSockets() {
	var io = require('socket.io').listen(httpsServer);
	io.on('connection', function(socket){
		console.warn("User connected...");

		socket.emit('get_brain', myNetwork.toJSON());
		console.log('Sent master brain to client!');
		
		socket.on('upload_knowledge', function(array) {
			for(var i=0; i<array.length; i+=1) {
				var item = array[i];
				myNetwork.activate([item[0], item[1]]);
				myNetwork.propagate(learningRate, [item[2]]);
			}
			
			totalItemsTrained += array.length;
			console.log('Trained on client knowledge! ' + array.length + ' items, and in total ' + totalItemsTrained);
			
			socket.emit('get_brain', myNetwork.toJSON());
			console.log('Sent master brain to client!');
		});
		
		
		socket.on('disconnect', function() {
			console.warn("User left...");
		});
	});
}