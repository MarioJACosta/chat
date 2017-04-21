var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var emoji = require('node-emoji');
var port = 8000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

var repeatedUser = 0;       // check if user exists
var listUsers = [];         // list of all users (user[0=>socket.id, 1=>user.userName, 2=>user.avatar, 3=>user.connected])
var listRooms = [];         // list of all rooms (room[0=>id=>[0=>socket.id, ...])
var listUserName = [];      // list of all names

io.on('connection', function (socket) {
    console.log(socket.id)
    var addedUser = false;

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (user) {

        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
            userName: user.userName,
            message: user.message
        });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (user) {

        if (addedUser) {
            return;
        }

        listUsers.forEach(function (entry) {
            if (entry.userId === user.userId) {
                ++repeatedUser;
            }
        });

        if (repeatedUser === 0) {
            listUsers.push({
                'socketId': socket.id,
                'userId': user.userId,
                'userName': user.userName,
                'connected': true
            });

            listUserName.push(user.userName);
        }

//        console.log(listUsers);
//        console.log('####################################');
//        console.log(listUserName);
//        console.log('####################################');

        // allows to store the socket id in the user object on the client side
        socket.emit('login', socket.id);

        // This is used to create the list of On/off line users
        socket.emit('listUsers', listUsers);

        addedUser = true;

        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', user);

        // when the client emits 'typing', we broadcast it to others
        socket.on('typing', function (user) {
            socket.broadcast.emit('typing', user);
        });

        // when the client emits 'stop typing', we broadcast it to others
        socket.on('stop typing', function (user) {
            socket.broadcast.emit('stop typing', user);
        });

        // when the user disconnects.
        socket.on('disconnect', function () {
            console.log(socket.id)
            listUsers.forEach(function (user) {
                if (user.socketId === socket.id) {
                    if (addedUser) {
                        // echo globally that this client has left
                        socket.broadcast.emit('user left', user.userId);
                    }
                }
            });
        });
    });
});