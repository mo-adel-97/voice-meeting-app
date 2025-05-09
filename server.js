const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// تشغيل ملفات الواجهة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io logic
io.on('connection', socket => {
  console.log('🔌 مستخدم متصل: ', socket.id);

  socket.on('join-room', roomID => {
    socket.join(roomID);
    console.log(`📞 المستخدم ${socket.id} دخل الغرفة ${roomID}`);

    // إعلام بقية الموجودين في الغرفة بوجود مستخدم جديد
    socket.to(roomID).emit('user-joined', socket.id);

    // لو خرج
    socket.on('disconnect', () => {
      console.log(`❌ المستخدم ${socket.id} خرج`);
      socket.to(roomID).emit('user-left', socket.id);
    });

    // استقبال الـ offer من مستخدم آخر
    socket.on('offer', (offer, id) => {
      socket.to(id).emit('offer', offer, socket.id);
    });

    // استقبال الـ answer من مستخدم آخر
    socket.on('answer', (answer, id) => {
      socket.to(id).emit('answer', answer);
    });

    // استقبال الـ ICE candidate من المستخدمين
    socket.on('ice-candidate', (candidate, id) => {
      socket.to(id).emit('ice-candidate', candidate);
    });
  });
});

// تشغيل السيرفر
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
});
