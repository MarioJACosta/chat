$(function () {

    // Initialize variables  #####################################################
    // Times
    var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms

    // Dom elements --------------------------------------------------------------
    var $body = $('body');
    var $window = $(window);
    var $usernameInput = $('.usernameInput');               // User nickname
    var $userImage = $('.avatarLogin');                     // User Avatar
    var $inputMessage = $('.chatAreaButtonsInputMessage');  // Input message input box
    var $chatAreaHeader = $('.chatAreaHeader');
    var $sendButton = $('#send');               // Send button
    var $deleteButton = $('#delete');           // Delete button
    var $usersOnlineList = $('#usersOnline');   // Users online ul element
    var $roomsList = $('#openRooms');           // Users online ul element
    var $messages = $('.messages');     // Messages ul element

    // Pages ----------------------------------------------------------------------
    var $loginPage = $('.login.page');  // The login page
    var $chatPage = $('.chat.page');    // The chatroom page

    var socket = io();      // socket object
    var user = [];          // user object    

    var connected = false;
    var typing = false;
    var lastTypingTime;
    var $currentInput = $usernameInput.focus();

    var originalDocumentTitle = document.title; // window title
    var timeout;                                // timeout for blinking title

    var cookies = getCookie();

    // The function getCookie returns false when there isn't any cookie ----------------
    if (cookies !== false) {
        if (typeof (cookies['userName']) !== 'undefined') {

            user = {
                'userName': cleanInput(cookies['userName']),
                'userImage': cleanInput(cookies['userImage']),
                'userId': cleanInput(cookies['userId']),
                'me': true
            };

            $chatPage.show();
            $loginPage.hide();
            $loginPage.off('click');

            //console.log(user)
            socket.emit('add user', user);

        } else {
//            user.userName = '';
//            user.userImage = '';
        }
    } else {
        $chatPage.hide();
        $loginPage.show();
    }

    // Socket events ###################################################################
    // Whenever the server emits 'login', log the login message
    socket.on('login', function (socketId) {
        
        // this if defines the user Id for the first socket id.
        if (typeof (cookies['userId']) === 'undefined') {
            setCookie('userId', socketId);
            user.userId = socketId;
        }

        setCookie('socketId', socketId);

        connected = true;
        user.connected = connected;
        $chatAreaHeader.append('<img src="avatares/' + user.userImage + '.png" class="chatAreaHeaderUserAvatar">');
        $chatAreaHeader.append('<h3 class="chatAreaHeaderUserInfotTitle">' + user.userName + '</h3>');
    });

    // receive the users online, in the login action
    socket.on('listUsers', function (listUsers) {
        listUsers.forEach(function (listUser) {
            addOnlineUser(listUser);
        });
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', function (user) {
        //console.log(user)
        addChatMessage(user);
        notificationSound();
        flashTitle(user.userName + " send a new message!", 10);
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', function (user) {
        addOnlineUser(user);
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', function (socketId) {
        removeOnlineUser(socketId);
//        removeChatTyping(user);
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', function (user) {
        addChatTyping(user);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', function (user) {
        removeChatTyping(user);
    });

    socket.on('disconnect', function (user) {
        console.log(user)
//        infoMessages('you have been disconnected');

    });

    socket.on('reconnect', function () {
//        infoMessages('you have been reconnected');
        if (user) {
            //console.log(user)
            socket.emit('add user', user);
            addOnlineUser(user)
        }
    });

    socket.on('reconnect_error', function () {
//        infoMessages('attempt to reconnect has failed');
    });

    // Keyboard events #################################################################
    $window.keydown(function (event) {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }

        // When the client hits ENTER on their keyboard
        if (event.which === 13) {

            if (user.userName) {

                socket.emit('stop typing');
                typing = false;
                sendMessage();
            } else {
                setUsername();
            }
        }
    });

    // Functions for the chat ##########################################################
    // Sets the client's username ------------------------------------------------------
    function setUsername() {
        if ($usernameInput.val() !== '') {
            if (typeof $('body').find('.clicked').attr('id') !== 'undefined') {

                user.userName = cleanInput($usernameInput.val().trim());
                user.userImage = $('body').find('.clicked').attr('id');

                // If the username is valid
                if (user) {
                    $loginPage.fadeOut();
                    $chatPage.fadeIn();
                    $loginPage.off('click');
                    $currentInput = $inputMessage.focus();

                    // Tell the server your username
                    socket.emit('add user', user);

                    // add username to localstorage
                    setCookie('userName', user.userName);
                    setCookie('userImage', user.userImage);
                }
            } else {
                alert('Oops... You need an avatar!');
            }
        } else {
            alert('Oops... We need to know your name!');
        }
    }

    // Updates the typing event -------------------------------------------------------- Falta confirmar a acao desta funcao
    function updateTyping() {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit('typing', user);
            }
            lastTypingTime = (new Date()).getTime();

            setTimeout(function () {
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }

    // add user in online list ---------------------------------------------------------
    function addOnlineUser(user) {
        var $list = $body.find('#' + user.userId);
        
        if ($list.length === 0) {
            $usersOnlineList.append('<li class="userOnline" data-socketId="' + user.socketId + '" id="' + user.userId + '"><i class="fa fa-user" aria-hidden="true"></i><span>' + user.userName + '</span></li>');
        } else {
            $list.children('i').removeClass('fa-user-times').addClass('fa-user');
        }
    }

    // remove user from online list ----------------------------------------------------
    function removeOnlineUser(userSocketId) {
        console.log(userSocketId)
        $usersOnlineList.find('#' + userSocketId).children('i').removeClass('fa-user').addClass('fa-user-times');
    }

    // Adds the visual chat typing message ---------------------------------------------
    function addChatTyping(user) {

        var $message = '<div class="spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>';
        var typingClass = user.typing ? 'typing' : '';

        var $balloonText = $('<div class="talktext"/>');
        var $usernameDiv = $('<p class="username"/>').text(user.userName);      // username  
        var $balloon = $('<div class="talk-bubble tri-right left-top"/>');
        
        $balloon = $balloon.append($balloonText.append($usernameDiv, $message));
        
        var $messageDiv = $('<li class="message" id="typing"/>')
                .data('userName', user.userName)
                .addClass(typingClass)
                .append($balloon);

        addMessageElement($messageDiv);
    }

    // Removes the visual chat typing message ------------------------------------------
    function removeChatTyping() {
        $('body').find('#typing').fadeOut('slow');
        $('body').find('#typing').remove();
    }

    // Emits a chat message ------------------------------------------------------------
    function sendMessage() {

        var message = $inputMessage.val();

        // Prevent markup from being injected into the message
        message = cleanInput(message);

        // if there is a non-empty message and a socket connection
        if (message && user.connected) {

            $inputMessage.val('');

            user.message = message;

            // add message to chat
            addChatMessage(user);

            // tell server to execute 'new message' and send along one parameter
            socket.emit('new message', user);
        }
    }

    // Adds the visual chat message to the message list --------------------------------
    function addChatMessage(user, options) {

        // Don't fade the message in if there is an 'X was typing'
        var $typingMessages = getTypingMessages(user);

        options = options || {};

        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }

        var $balloonText = $('<div class="talktext"/>');                        // wrapper div for username and message body
        var $messageBodyDiv = $('<p class="messageBody"/>').text(user.message); // message body
        var typingClass = user.typing ? 'typing' : '';                          // typing class

        // if it is the same user talking send text to right
        if (user.me) {
            var msgClass = 'right';
            var $balloon = $('<div class="talk-bubble tri-right right-top"/>');
//            var $userAvatar = $('<img src="avatares/' + user.userImage + '.png" class="img-circle avatar avatar-right">');
        } else {
            var msgClass = '';
            var $balloon = $('<div class="talk-bubble tri-right left-top"/>');
//            var $userAvatar = $('<img src="avatares/' + user.userImage + '.png" class="img-circle avatar avatar-left">');
        }

        var $usernameDiv = $('<p class="username ' + msgClass + '"/>').text(user.userName);      // username  

        // appends the username and message texts to the wrapper
        $balloon = $balloon.append($balloonText.append($usernameDiv, $messageBodyDiv));

        // appends the texts to the li element
        var $messageDiv = $('<li class="message ' + msgClass + '"/>')
                .data('userName', user.userName)
                .addClass(typingClass)
                .append($balloon);

        addMessageElement($messageDiv, options);
    }

    // Adds a message element to the messages and scrolls to the bottom ----------------
    // el - The element to add as a message
    // options.fade - If the element should fade-in (default = true)
    // options.prepend - If the element should prepend
    // all other messages (default = false)
    function addMessageElement(el, options) {

        var $el = $(el);

        // Setup default options
        if (!options) {
            options = {};
        }
        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }

        // Apply options
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $messages.prepend($el);
        } else {
            $messages.append($el);
        }
        $messages[0].scrollTop = $messages[0].scrollHeight;
    }

    // Gets the 'X is typing' messages of a user --------------------------------------- Falta confirmar a acao desta funcao
    function getTypingMessages(user) {
        return $('.typing.message').filter(function (i) {
            return $(this).data('username') === user.userName;
        });
    }

    // Prevents input from having injected markup --------------------------------------
    function cleanInput(input) {
        return $('<div/>').text(input).text();
    }

    // set cookies ---------------------------------------------------------------------
    function setCookie(field, value) {
        document.cookie = field + '=' + value;
    }

    // get cookies and return an array -------------------------------------------------
    function getCookie() {
        var data = [];
        var cookies = document.cookie.split(';');
        if (cookies[0]) {
            cookies.forEach(function (cookie) {
                cookie = cookie.split('=');
                data[cookie[0].trim()] = cookie[1].trim();
            });
        } else {
            data = false;
        }
        return data;
    }

    // audio for new message received --------------------------------------------------
    function notificationSound() {
        var audio = new Audio('notificationSound.mp3');
        audio.play();
    }

    // CLICK EVENTS ####################################################################
    // Focus input when clicking anywhere on login page --------------------------------
    $loginPage.click(function () {
        $currentInput.focus();
    });

    // Focus input when clicking on the message input's border -------------------------
    $inputMessage.click(function () {
        $inputMessage.focus();
    });

    // send message onclick ------------------------------------------------------------
    $sendButton.click(function () {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
    });

    // delete message ------------------------------------------------------------------
    $deleteButton.click(function () {
        $inputMessage.val('');
    });

    // choose avatar -------------------------------------------------------------------
    $userImage.click(function () {
        $(this).addClass('clicked');
        $(this).siblings().removeClass('clicked');
    });

    // gives message is typing ---------------------------------------------------------
    $inputMessage.on('input', function () {
        updateTyping();
    });

    // make title blink with new message -----------------------------------------------
    window.flashTitle = function (newMsg, howManyTimes) {
        function step() {
            document.title = (document.title === originalDocumentTitle) ? newMsg : originalDocumentTitle;

            if (--howManyTimes > 0) {
                timeout = setTimeout(step, 1000);
            }
        }

        howManyTimes = parseInt(howManyTimes);

        if (isNaN(howManyTimes)) {
            howManyTimes = 5;
        }

        cancelFlashTitle(timeout);
        step();
    };

    window.cancelFlashTitle = function () {
        clearTimeout(timeout);
        document.title = originalDocumentTitle;
    };
});
