const path = require('path');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb('Error: Images only!');
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const imageUrl = `https://3000-alphatheass-locationbas-99o6ynwmkzu.ws-us114.gitpod.io/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

const users = new Map();
const messages = new Map();  // To store messages by ID
let messageIdCounter = 0;  // To generate unique message IDs

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

async function deleteImage(filename) {
  const filepath = path.join(__dirname, 'uploads', filename);
  try {
    await fs.unlink(filepath);
    console.log(`Deleted image: ${filename}`);
  } catch (err) {
    console.error(`Error deleting image: ${filename}`, err);
  }
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
          io.to(otherUser.id).emit('new-message', { 
            id: messageIdCounter++,
            name: 'System', 
            message: `${name} has joined the chat.` 
          });
        }
      }
    });

    socket.emit('login_success', { name, nearbyUsers });
  });

  socket.on('send-message', (data) => {
    const user = users.get(socket.id);
    const messageId = messageIdCounter++;
    const messageData = { 
      id: messageId,
      name: user.name, 
      ...data // This includes 'message' for text or 'type' & 'message' for images
    };

    if (data.replyTo) {
      const repliedMessage = messages.get(data.replyTo.id);
      if (repliedMessage) {
        messageData.replyTo = {
          id: repliedMessage.id,
          name: repliedMessage.name,
          message: repliedMessage.message
        };
      }
    }

    messages.set(messageId, messageData);
    io.to(Array.from(socket.rooms)).emit('new-message', messageData);
    if (data.type === 'image' && data.selfDestruct) {
      const imageFilename = path.basename(data.message);
      setTimeout(() => {
        deleteImage(imageFilename);
        io.to(Array.from(socket.rooms)).emit('delete-message', { id: messageId });
      }, data.selfDestruct * 1000);
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.to(Array.from(socket.rooms)).emit('new-message', { 
        id: messageIdCounter++,
        name: 'System', 
        message: `${user.name} has left the chat.` 
      });
      console.log(`${user.name} disconnected`);
    }
  });
});

http.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

