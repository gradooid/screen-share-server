const express = require('express');
require('dotenv').config();
const volleyball = require('volleyball');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const { nanoid } = require('nanoid');
const cors = require('cors');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src/views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(process.cwd(), 'src/public')));
app.use(volleyball);
app.use(
  cors({
    origin: '*',
  })
);

app.get('/', (req, res) => {
  res.render('index');
});

const rooms = [];

function createRoom() {
  return {
    id: nanoid(),
    users: [],
  };
}

io.use((socket, next) => {
  console.log(socket.handshake.auth.id);
  next();
});

io.on('connection', (socket) => {
  // socket.on('offer', (data) => {
  //   socket.broadcast.emit('offer', data);
  // });

  // socket.on('init', () => {
  //   io.emit('init');
  // });

  // socket.on('save', async (blob) => {
  //   console.log(blob);
  //   await fs.writeFile(
  //     path.join(
  //       process.cwd(),
  //       'src/public/recordings',
  //       `${new Date().getTime()}.mkv`
  //     ),
  //     blob
  //   );
  // });

  socket.on('room:create', (user, cb) => {
    const room = createRoom();
    room.users.push(user);
    rooms.push(room);
    socket.join(room.id);

    cb &&
      cb({
        status: 200,
        data: room,
      });
  });

  socket.on('room:join', (roomId, user, cb) => {
    const room = rooms.find((room) => room.id === roomId);
    if (!room) {
      cb &&
        cb({
          status: 404,
          data: 'Room not found',
        });
      return;
    }

    const existingUser = room.users.find(({ id }) => id === user.id);
    if (existingUser) {
      cb &&
        cb({
          status: 400,
          data: 'User already in this room',
        });
      return;
    }

    room.users.push(user);
    socket.join(room.id);
    socket.broadcast.to(room.id).emit('user:joined', user);
    console.log('User joined', user.username, room.users);
    cb &&
      cb({
        status: 200,
        data: room,
      });
  });

  socket.on('room:leave', leaveRoom);

  socket.on('room:get', (roomId, cb) => {
    const room = rooms.find((room) => room.id === roomId);
    if (!room) {
      cb &&
        cb({
          status: 404,
          data: 'Room not found',
        });
      return;
    }

    cb &&
      cb({
        status: 200,
        data: room,
      });
  });

  function leaveRoom(roomId, user, cb) {
    const room = rooms.find(
      (room) => !!room.users.find(({ id }) => user.id === id)
    );

    if (!room) {
      cb &&
        cb({
          status: 404,
          data: 'Room not found',
        });
      return;
    }

    for (let i = 0; i < room.users.length; i++) {
      const roomUser = room.users[i];
      if (roomUser.id === user.id) {
        socket.leave(room.id);
        socket.broadcast.to(room.id).emit('user:left', user);
        console.log('User left', user.username, room.users);
        room.users.splice(i, 1);
        cb &&
          cb({
            status: 200,
            data: 'Success',
          });
        return;
      }
    }

    cb &&
      cb({
        status: 400,
        data: 'User not in the room',
      });
  }

  socket.on('disconnect', () => {
    leaveRoom(null, { id: socket.handshake.auth.id }, (res) => {
      console.log(res);
    });
  });
});

module.exports = httpServer;
