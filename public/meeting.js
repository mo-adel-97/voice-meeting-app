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

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 🔸 Local mic indicator
    const localAnalyser = audioContext.createAnalyser();
    const localSource = audioContext.createMediaStreamSource(localStream);
    localSource.connect(localAnalyser);
    localAnalyser.fftSize = 512;
    const localData = new Uint8Array(localAnalyser.frequencyBinCount);
    setInterval(() => {
      localAnalyser.getByteFrequencyData(localData);
      const volume = localData.reduce((a, b) => a + b) / localData.length;
      document.getElementById("micStatus").style.backgroundColor = volume > 10 ? "green" : "gray";
    }, 100);

    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // 🔸 Create and attach empty remote stream
    remoteStream = new MediaStream();
    document.getElementById('remoteAudio').srcObject = remoteStream;

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
        console.log("📡 صوت من الطرف التاني:", track.kind);
      });

      // تحليل صوت الطرف الآخر
      const remoteSource = audioContext.createMediaStreamSource(remoteStream);
      const remoteAnalyser = audioContext.createAnalyser();
      remoteSource.connect(remoteAnalyser);
      remoteAnalyser.fftSize = 512;
      const remoteData = new Uint8Array(remoteAnalyser.frequencyBinCount);
      setInterval(() => {
        remoteAnalyser.getByteFrequencyData(remoteData);
        const volume = remoteData.reduce((a, b) => a + b) / remoteData.length;
        document.getElementById("remoteStatus").style.backgroundColor = volume > 10 ? "green" : "gray";
      }, 100);
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

    peerConnection.oniceconnectionstatechange = () => {
      console.log("🔁 ICE state:", peerConnection.iceConnectionState);
    };

  } catch (err) {
    console.error('❌ خطأ في تشغيل المايك:', err);
  }
}
