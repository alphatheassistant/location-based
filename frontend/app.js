const status = document.getElementById('status');
const chat = document.getElementById('chat');
const messages = document.getElementById('messages');
const msgForm = document.getElementById('msgForm');
const msgInput = document.getElementById('msgInput');

const socket = io('http://localhost:3000');

function getLocation() {
  if (navigator.geolocation) {
    status.textContent = 'Getting your location...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        socket.emit('login', { latitude, longitude });
      },
      err => {
        status.textContent = 'Error: The Geolocation service failed.';
      }
    );
  } else {
    status.textContent = 'Error: Your browser doesn\'t support geolocation.';
  }
}

socket.on('connect', getLocation);

socket.on('login_success', data => {
  status.textContent = `Connected as ${data.name}. Nearby users: ${data.nearbyUsers.join(', ')}`;
  chat.style.display = 'block';
});

socket.on('new-message', data => {
  const li = document.createElement('li');
  li.textContent = `${data.name}: ${data.message}`;
  messages.appendChild(li);
});

msgForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = msgInput.value;
  if (message) {
    socket.emit('send-message', message);
    msgInput.value = '';
  }
});
