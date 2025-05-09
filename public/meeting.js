const socket = io();
let localStream;
let remoteStream;
let peerConnection;
let roomID;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function log(label, data) {
  console.log(`🧩 [${label}]`, data || '');
}

function joinRoom() {
  roomID = document.getElementById('roomInput').value || Math.random().toString(36).substring(2, 8);
  log("Room Joined", roomID);
  socket.emit('join-room', roomID);
  startCall();
}

async function startCall() {
  try {
    log("StartCall", "🚀 Initializing local audio");

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    document.getElementById('localAudio').srcObject = localStream;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

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

    remoteStream = new MediaStream();
    document.getElementById('remoteAudio').srcObject = remoteStream;

    peerConnection.ontrack = (event) => {
      log("Track Received", event.track.kind);
      event.streams[0].getTracks().forEach(track => {
        if (track.kind === 'audio') {
          remoteStream.addTrack(track);

          const remoteSource = audioContext.createMediaStreamSource(new MediaStream([track]));
          const remoteAnalyser = audioContext.createAnalyser();
          remoteSource.connect(remoteAnalyser);
          remoteAnalyser.fftSize = 512;
          const remoteData = new Uint8Array(remoteAnalyser.frequencyBinCount);
          setInterval(() => {
            remoteAnalyser.getByteFrequencyData(remoteData);
            const volume = remoteData.reduce((a, b) => a + b) / remoteData.length;
            document.getElementById("remoteStatus").style.backgroundColor = volume > 10 ? "green" : "gray";
          }, 100);
        }
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log("ICE Candidate Sent", event.candidate);
        socket.emit('ice-candidate', event.candidate, roomID);
      }
    };

    socket.on('ice-candidate', (candidate) => {
      log("ICE Candidate Received", candidate);
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('user-joined', async (id) => {
      log("User Joined Room", id);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      log("Sending Offer", id);
      socket.emit('offer', offer, id);
    });

    socket.on('offer', async (offer, id) => {
      log("Received Offer", id);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      log("Sending Answer", id);
      socket.emit('answer', answer, id);
    });

    socket.on('answer', (answer) => {
      log("Received Answer");
      peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    peerConnection.oniceconnectionstatechange = () => {
      log("ICE State", peerConnection.iceConnectionState);
    };

  } catch (err) {
    log("Mic Error", err);
  }
}
