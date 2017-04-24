var fse = require("fs-extra");
var synaptic = require('synaptic');
var klaw = require('klaw');
var path = require('path');

// SET UP NEURAL NETS

var root = __dirname + '/public';
var pathToBrain = root + "/pong/brain.json";

var learningRate = .3;
var Neuron = synaptic.Neuron;
var Layer = synaptic.Layer;
var Network = synaptic.Network; 
var Trainer = synaptic.Trainer;

fse.exists(pathToBrain, function(exists) {
    if (exists) {
		fse.readFile(pathToBrain, function read(err, data) {
			if (err) {
				return console.log(err);
			}
			
			var brainExtract = JSON.parse(data);
			var myNetwork = Network.fromJSON(brainExtract);
			
			console.log("Loaded brain!");
			
			train(myNetwork);
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

		var myNetwork = new Network({
			input: inputLayer,
			hidden: [hiddenLayer, hiddenLayer2],
			output: outputLayer
		});
		
		hiddenLayer.neurons().map(function(x) { x.squash = Neuron.squash.TANH; });
		hiddenLayer2.neurons().map(function(x) { x.squash = Neuron.squash.TANH; });
		
		train(myNetwork);
	}
});

function train(myNetwork) {
	
	var trainingSet = [];
	var filesArray = [];
	var filesCount = 0;
	var filesRead = 0;
	var finishedCounting = false;
	
	klaw("public/pong/training_data").on('data', function (item) {
		
		var dir = item.path.indexOf(".") == -1;
		// if its a file
		if (!dir) {
			
			filesCount += 1;
			
			var filepath = item.path;
			
			fse.readFile(item.path, function read(err, data) {
				
				filesRead += 1;
				
				if (err) {
					if (finishedCounting && filesRead == filesCount) {
						startTrain(myNetwork, trainingSet, filesArray);
					}
					return console.log(err);
				} else {
					
					filesArray.push(filepath);
					
					var array = JSON.parse(data);
				
					for(var i=0; i<array.length; i+=1) {
						var item = array[i];
						trainingSet.push({
							'input' : [item[0], item[1]],
							'output': [item[2]]
						});
					}
				
					if (finishedCounting && filesRead == filesCount) {
						startTrain(myNetwork, trainingSet, filesArray);
					}
				}
			});
		}
	}).on('end', function() {
		finishedCounting = true;
	});
}

function startTrain(myNetwork, trainingSet, filesArray) {
	console.log("Training now...");
	
	var trainer = new Trainer(myNetwork);
	
	trainer.train(trainingSet,{
		rate: .1,
		iterations: 20000000,
		error: .005,
		shuffle: true,
		log: 1000,
		cost: Trainer.cost.CROSS_ENTROPY
	});
	
	console.log("Moving files now...");
	
	/*
	for(var i=0; i<filesArray.length; i+=1) {
		var filename = path.basename(filesArray[i]);
		fse.move(filesArray[i], 'public/pong/trained_data/' + filename, function(err) {
			if (err) return console.error(err)
		});
	}
	*/

	runSave(myNetwork);
}

function runSave(myNetwork) {
	var brainExtract = JSON.stringify(myNetwork.toJSON());
	fse.writeFile(pathToBrain, brainExtract, function(err) {
		if(err) {
			return console.log(err);
		}
		console.log("Brain was saved!");
	});
}