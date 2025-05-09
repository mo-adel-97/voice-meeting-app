const socket = io();

let localStream;
let remoteStream;
let peerConnection;

// إعدادات WebRTC
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// الحصول على الصوت من الميكروفون
async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const localAudio = document.getElementById('localAudio');
    localAudio.srcObject = localStream;

    // إنشاء peer connection
    peerConnection = new RTCPeerConnection(config);
    peerConnection.addStream(localStream);

    // إرسال الـ ICE candidates للمستخدمين الآخرين
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    // استقبال الـ ICE candidates
    socket.on('ice-candidate', (candidate) => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // استقبال الفيديو من المستخدمين الآخرين
    peerConnection.onaddstream = (event) => {
      remoteStream = event.stream;
      const remoteAudio = document.getElementById('remoteAudio');
      remoteAudio.srcObject = remoteStream;
    };

    // إرسال الـ offer عندما المستخدم ينضم لغرفة الاجتماع
    socket.on('user-joined', async (id) => {
      console.log('مستخدم انضم، إرسال عرض الاتصال');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer, id);
    });

    // استقبال الـ offer من مستخدم آخر
    socket.on('offer', async (offer, id) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer, id);
    });

    // استقبال الـ answer من مستخدم آخر
    socket.on('answer', (answer) => {
      peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });
  } catch (err) {
    console.error('Error accessing media devices.', err);
  }
}

startCall();
