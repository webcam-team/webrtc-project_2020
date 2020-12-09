const path = require('path');

const https = require('https');
const fs = require('fs');
const os = require('os');
const nodeStatic = require('node-static');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
//HTTPS로 접속하기 위한 인증서
const options = {
  key: fs.readFileSync('keys/key.pem'),
  cert: fs.readFileSync('keys/cert.pem')
};
let fileServer = new(nodeStatic.Server)();
//서버 실행
let app = https.createServer(options,(req,res)=>{
    fileServer.serve(req,res);
}).listen(443);

let io = socketio.listen(app);

const botName = 'PolyChat';
//화상기능 현재 접속중인 방과 현재 접속중인 인원이 들어가있는 변수
var roomNow;
var clientsArray = {};
// 클라이언트 연결시 실행
io.on('connection', socket=> {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to Chating room!'));

    //사용자가 연결할 때 브로드 캐스팅
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    //사용자 및 방 정보 보내기
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
    //여기서부터 화상 기능
        roomNow = room;

         if(clientsArray[room] === undefined)
             clientsArray[room] = [];
         clientsArray[room].push(socket.id);

         log('Received request to create or join room ' + room);

         var numClients = clientsArray[room].length;
          log('Room ' + room + ' now has ' + numClients + ' client(s)');

          if(numClients === 1 ){
              console.log('create room!');
              socket.join(room);
              log('Client ID ' + socket.id + ' created room ' + room);
              socket.emit('created',room,socket.id);
          }
          else{
              console.log('join room!');
              log('Client Id' + socket.id + 'joined room' + room);
              io.sockets.in(room).emit('join',room);
              socket.join(room);
              socket.emit('joined',room,socket.id);
              io.sockets.in(room).emit('ready');
            }


          function log() {
              let array = ['Message from server:'];
              array.push.apply(array,arguments);

          }

          socket.on('message1',(message)=>{
              log('Client said : ' + message + 'roomNow :' + roomNow);
              socket.to(roomNow).emit('message1',message);
          });

          //여기까지 화상기능
  });

  //텍스트 채팅 메시지 전송
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  //클라이언트 연결이 끊어 졌을 때 실행
  socket.on('disconnect', (username) => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );
     io.to(user.room).emit('disconnected');

      //유저랑 방이름 정보 전송
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });

});
