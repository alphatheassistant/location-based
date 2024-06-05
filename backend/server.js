const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const users = new Map();
const getRandomName = () => `User${Math.floor(Math.random() * 10000)}`;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
           Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('login', (data) => {
    const { latitude, longitude } = data;
    const name = getRandomName();
    const user = { id: socket.id, name, latitude, longitude };
    users.set(socket.id, user);

    const nearbyUsers = [];
    users.forEach(otherUser => {
      if (otherUser.id !== socket.id) {
        const distance = calculateDistance(latitude, longitude, otherUser.latitude, otherUser.longitude);
        if (distance <= 1) {
          nearbyUsers.push(otherUser.name);
          socket.join(otherUser.id);
          io.to(otherUser.id).emit('new-message', { name: 'System', message: `${name} has joined the chat.` });
        }
      }
    });

    socket.emit('login_success', { name, nearbyUsers });
  });

  socket.on('send-message', (message) => {
    const user = users.get(socket.id);
    io.to(Array.from(socket.rooms)).emit('new-message', { name: user.name, message });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.to(Array.from(socket.rooms)).emit('new-message', { name: 'System', message: `${user.name} has left the chat.` });
    }
  });
});

http.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
