const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  console.log('🔌 مستخدم متصل: ', socket.id);

  socket.on('join-room', roomID => {
    socket.join(roomID);
    console.log(`📞 المستخدم ${socket.id} دخل الغرفة ${roomID}`);

    // إعلام الموجودين في الغرفة بوجود مستخدم جديد
    socket.to(roomID).emit('user-joined', socket.id);

    socket.on('disconnect', () => {
      console.log(`❌ المستخدم ${socket.id} خرج`);
      socket.to(roomID).emit('user-left', socket.id);
    });

    socket.on('offer', (offer, targetID) => {
      socket.to(targetID).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, targetID) => {
      socket.to(targetID).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate, targetID) => {
      socket.to(targetID).emit('ice-candidate', candidate);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
});
