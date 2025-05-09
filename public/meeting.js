const socket = io();
let localStream;
let remoteStream;
let peerConnection;
let roomID;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function joinRoom() {
  roomID = document.getElementById('roomInput').value || Math.random().toString(36).substring(2, 8);
  socket.emit('join-room', roomID);
  alert(`📎 Room ID: ${roomID}`);
  startCall();
}

async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    document.getElementById('localAudio').srcObject = localStream;

    // 🎤 تحليل الصوت
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    analyser.fftSize = 512;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const icon = document.getElementById("micStatus");
      icon.style.backgroundColor = volume > 10 ? "green" : "gray";
    }, 100);

    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    remoteStream = new MediaStream();
    document.getElementById('remoteAudio').srcObject = remoteStream;

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate, roomID);
      }
    };

    socket.on('ice-candidate', (candidate) => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('user-joined', async (id) => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer, id);
    });

    socket.on('offer', async (offer, id) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer, id);
    });

    socket.on('answer', (answer) => {
      peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

  } catch (err) {
    console.error('❌ خطأ في الميكروفون:', err);
  }
}
