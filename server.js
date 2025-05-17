const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; // roomId -> { users: Set<socketId>, host: socketId }

io.on('connection', socket => {
  console.log('🔌 مستخدم متصل: ', socket.id);

  socket.on('join-room', ({ roomID, isHost }) => {
    socket.join(roomID);
    if (!rooms[roomID]) {
      rooms[roomID] = { users: new Set(), host: null };
    }

    rooms[roomID].users.add(socket.id);
    if (isHost) rooms[roomID].host = socket.id;

    // إعلام المستخدمين الحاليين
    socket.to(roomID).emit('user-joined', { id: socket.id });

    // إرسال قائمة المستخدمين الجديدة للجميع
    io.to(roomID).emit('update-users', Array.from(rooms[roomID].users).map(id => ({ id })));

    socket.on('disconnect', () => {
      console.log(`❌ المستخدم ${socket.id} خرج`);
      rooms[roomID]?.users.delete(socket.id);

      if (rooms[roomID] && rooms[roomID].users.size === 0) {
        delete rooms[roomID];
      } else {
        io.to(roomID).emit('update-users', Array.from(rooms[roomID].users).map(id => ({ id })));
      }
    });

    socket.on('offer', ({ offer, target }) => {
      io.to(target).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ answer, target }) => {
      io.to(target).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('force-mute', targetID => {
      if (rooms[roomID]?.host === socket.id) {
        io.to(targetID).emit('force-mute');
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
});