const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get('room');
const isHost = urlParams.get('host') === '1';
const usersList = document.getElementById('usersList');
const audioContainer = document.getElementById('audioContainer');
const selfMuteBtn = document.getElementById('selfMuteBtn');
const hostBadge = document.getElementById('hostBadge');

if (isHost) hostBadge.style.display = 'inline';
document.getElementById('roomInfo').innerText = `معرّف الغرفة: ${roomID}`;

let localStream;
let peers = {};
let isMuted = false;

async function initStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  addAudioElement(socket.id, localStream, true);
  addSelfVoiceIndicator(localStream);
  socket.emit('join-room', { roomID, isHost });
}

function addAudioElement(id, stream, isLocal = false) {
  let audio = document.createElement('audio');
  audio.id = `audio-${id}`;
  audio.autoplay = true;
  audio.controls = true;
  if (isLocal) audio.muted = true;
  audio.srcObject = stream;
  audioContainer.appendChild(audio);
}

function addVoiceIndicator(userId, stream) {
  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 512;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const lightEl = document.createElement('span');
  lightEl.style.width = '10px';
  lightEl.style.height = '10px';
  lightEl.style.borderRadius = '50%';
  lightEl.style.marginRight = '10px';
  lightEl.style.backgroundColor = 'gray';
  lightEl.id = `voice-${userId}`;

  const userDiv = document.getElementById(`user-${userId}`);
  if (userDiv) userDiv.prepend(lightEl);

  setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    lightEl.style.backgroundColor = volume > 10 ? 'green' : 'gray';
  }, 100);
}

function addSelfVoiceIndicator(stream) {
  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 512;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const lightEl = document.createElement('span');
  lightEl.style.width = '10px';
  lightEl.style.height = '10px';
  lightEl.style.borderRadius = '50%';
  lightEl.style.marginRight = '10px';
  lightEl.style.backgroundColor = 'gray';
  lightEl.id = `voice-${socket.id}`;
  selfMuteBtn?.prepend(lightEl);

  setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    lightEl.style.backgroundColor = volume > 10 ? 'green' : 'gray';
  }, 100);
}

function updateUserList(users) {
  usersList.innerHTML = '';
  users.forEach(user => {
    if (user.id === socket.id) return;
    const div = document.createElement('div');
    div.className = 'user';
    div.id = `user-${user.id}`;
    div.innerHTML = `
      <span>${user.id}</span>
      ${isHost ? `<button onclick="muteUser('${user.id}')">🔇 كتم</button>` : ''}
    `;
    usersList.appendChild(div);
  });
}

function toggleMuteSelf() {
  isMuted = !isMuted;
  localStream.getAudioTracks()[0].enabled = !isMuted;
  selfMuteBtn.innerText = isMuted ? '🎤 تشغيل المايك' : '🔇 كتم المايك';
}

function muteUser(userId) {
  socket.emit('force-mute', userId);
}

function createPeerConnection(userId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { target: userId, candidate: event.candidate });
    }
  };

  pc.ontrack = event => {
    let remoteStream = new MediaStream();
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    addAudioElement(userId, remoteStream);
    addVoiceIndicator(userId, remoteStream);
  };

  peers[userId] = pc;
  return pc;
}

socket.on('user-joined', async ({ id }) => {
  const pc = createPeerConnection(id);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { offer, target: id });
});

socket.on('offer', async ({ offer, from }) => {
  const pc = createPeerConnection(from);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { answer, target: from });
});

socket.on('answer', async ({ answer, from }) => {
  const pc = peers[from];
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', ({ from, candidate }) => {
  const pc = peers[from];
  if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('update-users', updateUserList);

socket.on('force-mute', () => {
  isMuted = true;
  localStream.getAudioTracks()[0].enabled = false;
  selfMuteBtn.innerText = '🎤 تشغيل المايك';
});

initStream();
