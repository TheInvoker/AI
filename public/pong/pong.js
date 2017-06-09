var main_width = 400;
var main_height = 300;
var scores = [0, 0];
var map = {38: false,40: false,87: false,83: false};
var game_board, paddle, paddles, ball; 
var balInfo = {};
var startTime = new Date();
var trainingDB = [];


// NN
var myNetwork = null;
var Network = synaptic.Network;



function resetBoardData() {
	
	var items = [135 + Math.random()*90];//, Math.random()*45, 315+Math.random()*45];
	var r_angle = items[Math.floor(Math.random()*items.length)];
	
	game_board = {
		'width' : main_width,
		'height' : main_height
	};
	paddle = {
		'width' : 10,
		'height' : 40,
		'speed' : 5
	};
	paddles = [
		{
			'x' : 10,
			'y' : game_board.height/2 - paddle.height/2
		},
		{
			'x' : game_board.width - paddle.width - 10,
			'y' : game_board.height/2 - paddle.height/2
		}
	];
	ball = {
		'radius' : 10,
		'x' : game_board.width/2,
		'y' : game_board.height/2,
		'angle' : r_angle,
		'o_angle' : r_angle,
		'speed' : 5,
		'speed2' : 9
	};
}

function drawGame() {
	// clear board
	ctx.clearRect(0,0,game_board.width,game_board.height);
	
	// draw board
	ctx.fillStyle = "black";
	ctx.fillRect(0,0,game_board.width,game_board.height); 
	
	// draw paddles
	ctx.fillStyle = "white";
	for(var i=0; i<paddles.length; i+=1) {
		ctx.fillRect(paddles[i].x,paddles[i].y,paddle.width,paddle.height); 
	}
	
	// draw ball
	ctx.fillStyle = "white";
	ctx.beginPath();
	ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.closePath();
	
	
	// draw score
	ctx.fillStyle = "white";
	ctx.font = "20px Arial";
	ctx.fillText(formatDate(startTime),game_board.width/2 - 70, 40);
	ctx.fillText(scores[0] + " - " + scores[1] + " (" + (100 * (scores[1]/scores[0])).toFixed(2) + ")",game_board.width/2 - 70, 60);
	ctx.fillText(getDateDiff(startTime, new Date()), game_board.width/2 - 70, 80);
}

function formatDate(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + "  " + strTime;
}
function getDateDiff(date_now, date_future) {
	// get total seconds between the times
	var delta = Math.abs(date_future - date_now) / 1000;

	// calculate (and subtract) whole days
	var days = Math.floor(delta / 86400);
	delta -= days * 86400;

	// calculate (and subtract) whole hours
	var hours = Math.floor(delta / 3600) % 24;
	delta -= hours * 3600;

	// calculate (and subtract) whole minutes
	var minutes = Math.floor(delta / 60) % 60;
	delta -= minutes * 60;

	// what's left is seconds
	var seconds = delta % 60;  // in theory the modulus is not required	
	
	return hours + "h " + minutes + "m " + Math.floor(seconds) + "s";
}


function getInput() {
	var a = Math.floor((balInfo.y/game_board.height) * 100);
	var b = Math.floor((balInfo.angle/360) * 100);
	var c = Math.floor((paddles[1].y/game_board.height) * 100);
	var a_s = a.toString(2);
	var b_s = b.toString(2);
	var c_s = c.toString(2);
	while (a_s.length < 7) a_s = '0' + a_s;
	while (b_s.length < 7) b_s = '0' + b_s;
	while (c_s.length < 7) c_s = '0' + c_s;
	var ri = (a_s + b_s + c_s).split('').map(function(d) {
		return parseInt(d, 10);
	});
	return ri;
}
function addToTrainingDB() {
	var ri = getInput();
	if (shouldMoveUp(ball, paddles[1], paddle)) { var ro = [1]; }
	else { var ro = [0]; }
	trainingDB.push([ri, ro]);
}

function checkForWin() {
	if (ball.x + ball.radius < 0) {   // went past left side
		scores[1] += 1;
		console.log('Right wins!');
		resetBoardData();
	} else if (ball.x - ball.radius > game_board.width) {   // went past right side
	
		if (balInfo.hasOwnProperty('y')) {
			//trainingDB.push([balInfo.y/game_board.height, balInfo.angle/360, ball.y/game_board.height]);
			addToTrainingDB();
		}
		
		scores[0] += 1;
		console.log('Left wins!');
		resetBoardData();
	}
}

function moveBall() {
	var nballx = ball.x + Math.cos(ball.angle * (Math.PI/180)) * ball.speed;
	var nbally = ball.y - Math.sin(ball.angle * (Math.PI/180)) * ball.speed;
	
	if (ball.y - ball.radius < 0 && ball.angle == ball.o_angle) { // hit top wall
		ball.angle = 360 - ball.angle;
		return;
	} else if (ball.y + ball.radius > game_board.height && ball.angle == ball.o_angle) { // hit bottom wall
		ball.angle = 360 - ball.angle;
		return;
	} else if (collides ({ x:paddles[0].x, y:paddles[0].y, w:paddle.width, h:paddle.height },{ x:nballx, y:nbally, r:ball.radius }, true) && ball.angle == ball.o_angle) { // hit left player paddle
		
		var d1 = distance(nballx, nbally, paddles[0].x+paddle.width/2, paddles[0].y);
		var d2 = distance(nballx, nbally, paddles[0].x+paddle.width/2, paddles[0].y+paddle.height);
		
		var a = angle(paddles[0].x+paddle.width/2, -(paddles[0].y+paddle.height/2), nballx, -nbally);
		if (a < 0) a = 360 + a;
		
		if (a > 90 && a < 270) {
			var r = ((Math.random()*2)-1) * 3;
			ball.angle = 360 - ball.angle + r;
		} else if (d1 <= ball.radius*1.5 || d2 <= ball.radius*1.5) {
			var r = ((Math.random()*2)-1) * 5;
			ball.angle = a + r;
			ball.speed = ball.speed2;
		} else {
			var r = ((Math.random()*2)-1) * 3;
			ball.angle = 180 - ball.angle + r;
			if (ball.angle < 0) ball.angle = 360+ball.angle;
		}
		
		balInfo.y = nbally;
		balInfo.angle = ball.angle;
		
		return;
	} else if (collides ({ x:paddles[1].x, y:paddles[1].y, w:paddle.width, h:paddle.height },{ x:nballx, y:nbally, r:ball.radius }, true) && ball.angle == ball.o_angle) {  // hit right player paddle
		
		var d1 = distance(nballx, nbally, paddles[1].x+paddle.width/2, paddles[1].y);
		var d2 = distance(nballx, nbally, paddles[1].x+paddle.width/2, paddles[1].y+paddle.height);
		
		var a = angle(paddles[1].x+paddle.width/2, -(paddles[1].y+paddle.height/2), nballx, -nbally);
		if (a < 0) a = 360 + a;
		
		if (a < 90 || a > 270) {
			var r = ((Math.random()*2)-1) * 3;
			ball.angle = 360 - ball.angle + r;
		} else if (d1 <= ball.radius*1.5 || d2 <= ball.radius*1.5) {	
			var r = ((Math.random()*2)-1) * 5;
			ball.angle = a + r;
			ball.speed = ball.speed2;
		} else {
			var r = ((Math.random()*2)-1) * 3;
			ball.angle = 180 - ball.angle + r;
			if (ball.angle < 0) ball.angle = 360+ball.angle;
		}
		
		return;
	} else {
		ball.o_angle = ball.angle;
	}
	
	ball.x = nballx;
	ball.y = nbally;
}



function angle(cx, cy, ex, ey) {
  var dy = ey - cy;
  var dx = ex - cx;
  var theta = Math.atan2(dy, dx); // range (-PI, PI]
  theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
  //if (theta < 0) theta = 360 + theta; // range [0, 360)
  return theta;
}

function distance(x1, y1, x2, y2) {
	var a = x1 - x2;
	var b = y1 - y2;
	var c = Math.sqrt( a*a + b*b );
	return c;
}

// http://stackoverflow.com/questions/21089959/detecting-collision-of-rectangle-with-circle
function collides(rect, circle, collide_inside) {
    // compute a center-to-center vector
    var half = { x: rect.w/2, y: rect.h/2 };
    var center = {
        x: circle.x - (rect.x+half.x),
        y: circle.y - (rect.y+half.y)};

    // check circle position inside the rectangle quadrant
    var side = {
        x: Math.abs (center.x) - half.x,
        y: Math.abs (center.y) - half.y};
    if (side.x >  circle.r || side.y >  circle.r) // outside
        return false; 
    if (side.x < -circle.r && side.y < -circle.r) // inside
        return collide_inside;
    if (side.x < 0 || side.y < 0) // intersects side or corner
        return true;

    // circle is near the corner
    return side.x*side.x + side.y*side.y  < circle.r*circle.r;
}




function moveRightPlayerUp() {
	paddles[1].y = Math.max(paddles[1].y - paddle.speed, 0);
}
function moveRightPlayerDown() {
	paddles[1].y = Math.min(paddles[1].y + paddle.speed, game_board.height - paddle.height);
}
function moveLeftPlayerUp() {
	paddles[0].y = Math.max(paddles[0].y - paddle.speed, 0);
}
function moveLeftPlayerDown() {
	paddles[0].y = Math.min(paddles[0].y + paddle.speed, game_board.height - paddle.height);
}

function movePaddle() {
    if (map['38']) {
        // up right player - up arrow
	moveRightPlayerUp();
    }
    if (map['40']) {
        // down right player - down arrow
	moveRightPlayerDown();
    }
    
    if (map['87']) {
        // up left player - W
	moveLeftPlayerUp();
    }
    if (map['83']) {
        // down left player - S
	moveLeftPlayerDown();
    }
}




var canvas = document.createElement('canvas');
canvas.width = main_width;
canvas.height = main_height;
var ctx = canvas.getContext("2d");
document.body.appendChild(canvas);











function gameLoop() {
	checkForWin();
	moveBall();
	movePaddle();
	drawGame();
	movePaddles();
}


function movePaddles() {
	// naive left player ai
	if (shouldMoveUp(ball, paddles[0], paddle)) moveLeftPlayerUp();
	else moveLeftPlayerDown();
	
	// machine learning right player ai
	if (balInfo.hasOwnProperty('y')) {
		var a = balInfo.y/game_board.height, b = balInfo.angle/360;
		if (a == balInfo.a && b == balInfo.b) {
			var predictedYPos = balInfo.predictedYPos;	
			moveToPredicted(predictedYPos);	
		} else {
			var ri = getInput();
			var ro = myNetwork.activate(ri);
			ro = Math.round(ro[0]);
			if (ro == 1) {
				moveRightPlayerUp();
			} else {
				moveRightPlayerDown();	
			}
			balInfo.a = a;
			balInfo.b = b;
			balInfo.predictedYPos = predictedYPos;
		}
	} else {
		var predictedYPos = ball.y;
		moveToPredicted(predictedYPos);	
	}
}

function moveToPredicted(predictedYPos) {
	var a = predictedYPos - paddles[1].y;
	if (a < 0) moveRightPlayerUp();
	else if (a > 0) moveRightPlayerDown();	
}
function shouldMoveUp(ball, mypaddle, paddle) {
	if (ball.y < mypaddle.y) return true;
	else if (ball.y > mypaddle.y + paddle.height) return false;
	else {
		if (ball.y < mypaddle.y + paddle.height/2) return true;
		else if (ball.y > mypaddle.y + paddle.height/2) return false;
		return true;
	}
}



// listen for key presses
$(document).keydown(function(e) {
    if (e.keyCode in map) {
        map[e.keyCode] = true;
    }
}).keyup(function(e) {
    if (e.keyCode in map) {
        map[e.keyCode] = false;
    }
});





// SERVER

function getBrain(onSuccess) {
	$.ajax({
		url: '/get_brain',
		type: 'POST',
		error: function(jqXHR, textStatus, errorThrown) {
			alert('An error has occurred');
		},
		success: function(data) {
			myNetwork = Network.fromJSON(JSON.parse(data));
			onSuccess();
		},
		complete: function() {
			setInterval(sendAndTrain, 30 * 1000);
		}
	});
}

getBrain(function() {
	resetBoardData();
	setInterval(gameLoop, 0);
});

function sendAndTrain() {
	$.ajax({
		url: '/train_and_get_brain',
		type: 'POST',
		data: {
			data: JSON.stringify(trainingDB)
		},
		error: function(jqXHR, textStatus, errorThrown) {
			//alert('An error has occurred');
		},
		success: function(data) {
			myNetwork = Network.fromJSON(JSON.parse(data));
			trainingDB.length = 0;
			scores = [0, 0];
			startTime = new Date();
		},
		complete: function() {
			setInterval(sendAndTrain, 30 * 1000);
		}
	});
}