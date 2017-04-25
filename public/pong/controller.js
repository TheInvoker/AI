// NN
var myNetwork = null;
var Network = synaptic.Network;

var main_width = 400;
var main_height = 300;
var trainingDB = [];
var balInfo = {};
	
var canvas = document.createElement('canvas');
canvas.width = main_width;
canvas.height = main_height;
var ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

var pongRunner = new PONG(ctx, main_width, main_height, function(game_board, ball) {

}, function(game_board, ball) {
	if (balInfo.hasOwnProperty('y')) {
		trainingDB.push([balInfo.y/game_board.height, balInfo.angle/360, ball.y/game_board.height]);
	}
}, function(nbally, angle) {
	balInfo.y = nbally;
	balInfo.angle = angle;
}, function(nbally, angle) {

}, function(moveDown, moveUp, ball, myPaddle, paddle, game_board) {
	if (ball.y < myPaddle.y) return moveUp;
	else if (ball.y > myPaddle.y + paddle.height) return moveDown;
	else {
		if (ball.y < myPaddle.y + paddle.height/2) return moveUp;
		else if (ball.y > myPaddle.y + paddle.height/2) return moveDown
	}
}, function(moveDown, moveUp, ball, myPaddle, paddle, game_board) {
	// machine learning right player ai
	if (balInfo.hasOwnProperty('y')) {
		var a = balInfo.y/game_board.height, b = balInfo.angle/360;
		if (a == balInfo.a && b == balInfo.b) {
			var predictedYPos = balInfo.predictedYPos;	
		} else {
			var predictedYPos = myNetwork.activate([a, b]) * game_board.height;
			balInfo.a = a;
			balInfo.b = b;
			balInfo.predictedYPos = predictedYPos;
		}
	} else {
		var predictedYPos = ball.y;
		moveToPredicted(predictedYPos, myPaddle, moveDown, moveUp);
	}
	moveToPredicted(predictedYPos, myPaddle, moveDown, moveUp);	
});

function moveToPredicted(predictedYPos, myPaddle, moveDown, moveUp) {
	var a = predictedYPos - myPaddle.y;
	if (a < 0) moveUp();
	else if (a > 0) moveDown();	
}

// SERVER

$.ajax({
	url: '/get_brain',
	type: 'GET',
	timeout: 10000,
	error: function(jqXHR, textStatus, errorThrown) {
		alert('An error has occurred');
	},
	success: function(data) {
		myNetwork = Network.fromJSON(data);
		pongRunner.resetBoardData();
		setInterval(pongRunner.gameLoop, 0);
	}
});

setInterval(function() {
	$.ajax({
		url: '/train',
		type: 'POST',
		timeout: 10000,
		data: {
			data: JSON.stringify(trainingDB)
		},
		error: function(jqXHR, textStatus, errorThrown) {
			alert('An error has occurred');
		},
		success: function(data) {
			myNetwork = Network.fromJSON(JSON.parse(data));
			trainingDB.length = 0;
			pongRunner.setScores([0, 0]);
			pongRunner.setStarttime(new Date());
		}
	});
}, 1000 * 60);