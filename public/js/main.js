const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const chatMessage = document.querySelector('.chat-message');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

const hangupButton = document.getElementById('hangupButton');
hangupButton.addEventListener('click', hangup);

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let isInitiator = false;
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;

//소켓 연결
let socket = io.connect({transports: ['websocket'],'pingInterval': 45000,'pingTimeout': 15000});


//URL에서 사용자 이름, 방 이름으로 넘기기
const { username,room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

//채팅방 참여
socket.emit('joinRoom', { username, room });

//사용자와 방 이름을 저장 할 공간 확보
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

//서버에서 온 메세지 outputMessage,1,2 로 전송
socket.on('message', message => {
  console.log(message);
outputMessage(message);
outputMessage1(message);
outputMessage2(message,username);
  // Scroll down 스크롤 최하단 정렬
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit 메세지 제출
chatForm.addEventListener('submit', e => {
  e.preventDefault();

  // Get message text 메세지 텍스트 가져오기
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg){
    return false;
  }

  //서버에 메세지 보내기
  socket.emit('chatMessage', msg);

  //메세지 입력값 초기화
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

//DOM에 메세지 출력
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>&nbsp;&nbsp;${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  div.appendChild(para);
  document.querySelector('.chat-messages').appendChild(div);
}

function outputMessage1(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>&nbsp;&nbsp;${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  div.appendChild(para);
  document.querySelector('.chat-message').appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
function outputMessage2(message,username) {
  const div = document.createElement('div');
  div.className = 'chatform';
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>&nbsp;&nbsp;${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  div.appendChild(para);
  document.querySelector('.chat-message').appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
//DOM에 방 이름 추가
function outputRoomName(room) {
  roomName.innerText = room;
}

//사용자 추가
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach(user=>{
    const li = document.createElement('li');
    li.innerText = user.username;
    num.innerHTML = users.length;
    userList.appendChild(li);
  });
 }


//여기서부터 화상 채팅 입장 기능부분
  if(room !==''){
    socket.emit('create or join',room);
    console.log('Attempted to create or join Room',room);
  }
//방 생성
socket.on('created', (room)=>{
  console.log('Created room' + room);
  isInitiator= true;
})
//방 최대인원 설정할 경우 사용가능
socket.on('full', room=>{
  console.log('Room '+room+'is full');
});
//화상 채팅방 입장
socket.on('join',(room)=>{
  console.log('Another peer made a request to join room' + room);
  console.log('This peer is the initiator of room' + room + '!');
  isChannelReady = true;
})
//화상 채팅 연결종료
socket.on('disconnected',() =>{
  pc.close();
})
socket.on('joined',room=>{
  console.log('joined : '+ room );
  isChannelReady= true;
})
socket.on('log', array=>{
  console.log.apply(console,array);
});
//화상 채팅 연결부분
socket.on('message1', (message)=>{
  console.log('Client received message :',message);
  if(message === 'got user media'){
    maybeStart();
  }else if(message.type === 'offer'){
    if(!isInitiator && !isStarted){
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  }else if(message.type ==='answer' && isStarted){
    pc.setRemoteDescription(new RTCSessionDescription(message));
  }else if(message.type ==='candidate' &&isStarted){
    const candidate = new RTCIceCandidate({
      sdpMLineIndex : message.label,
      candidate:message.candidate
    });

    pc.addIceCandidate(candidate);
  }
})
function sendMessage(message){
  console.log('Client sending message: ',message);
  socket.emit('message1',message);
}

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then(gotStream)
  .catch((error) => console.error(error));

function gotStream(stream) {
  console.log("Adding local stream");
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage("got user media");
  if (isInitiator) {
    maybeStart();
  }
}
//Google stun 무료 서버
function createPeerConnection() {
  var pcConfig = {
      'iceServers': [{
          'urls': 'stun:stun.l.google.com:19302'},]
  }
//유저의 peer 수집해서 연결
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    console.log("Created RTCPeerConnection");
  } catch (e) {
    alert("connot create RTCPeerConnection object");
    return;
  }
}

function handleIceCandidate(event) {
  console.log("iceCandidateEvent", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("end of candidates");
  }
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

function handleRemoteStreamAdded(event) {
  console.log("remote stream added");
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function maybeStart() {
  console.log(">>MaybeStart() : ", isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
    console.log(">>>>> creating peer connection");
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log("isInitiator : ", isInitiator);
    if (isInitiator) {
      doCall();
    }
  }else{
    console.error('maybeStart not Started!');
  }
}

function doCall() {
  console.log("Sending offer to peer");
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log("Sending answer to peer");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.error("Falied to create session Description", error);
}
function hangup() {
  console.log('Ending call');
  pc.close();
  pc = null;
}
//여기까지
