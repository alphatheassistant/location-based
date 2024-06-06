const status = document.getElementById('status');
const chat = document.getElementById('chat');
const messages = document.getElementById('messages');
const msgForm = document.getElementById('msgForm');
const msgInput = document.getElementById('msgInput');
const replyingToDiv = document.getElementById('replyingTo');
const replyingToText = document.getElementById('replyingToText');
const cancelReplyBtn = document.getElementById('cancelReply');
const imageUpload = document.getElementById('imageUpload');
const imageBtn = document.getElementById('imageBtn');
const imageModal = document.getElementById('imageModal');
const fullImage = document.getElementById('fullImage');
const closeModal = document.getElementById('closeModal');
const imageOptions = document.getElementById('imageOptions');
const selfDestructBtn = document.getElementById('selfDestructBtn');

const socket = io('https://3000-alphatheass-locationbas-99o6ynwmkzu.ws-us114.gitpod.io');
let replyingTo = null;
let uploadedImage = null;

function createMessageElement(data) {
  const li = document.createElement('li');
  li.className = 'message';
  li.id = `msg-${data.id}`;
  
  const content = document.createElement('div');
  content.className = 'text';
  if (data.type === 'image') {
    content.textContent = `${data.name} shared an image:`;
    const img = document.createElement('img');
    img.src = data.message;
    img.alt = 'Shared Image';
    img.onclick = () => {
      fullImage.src = img.src;
      imageModal.style.display = 'block';
    };
    content.appendChild(img);

    if (data.selfDestruct) {
      setTimeout(() => {
        const msgEl = document.getElementById(`msg-${data.id}`);
        if (msgEl) {
          msgEl.remove();
          if (fullImage.src === img.src) {
            imageModal.style.display = 'none';
          }
        }
      }, 10000);  // 10 seconds
    }
  } else {
    content.textContent = `${data.name}: ${data.message}`;
  }
  li.appendChild(content);

  if (data.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply';
    replyDiv.textContent = `↳ ${data.replyTo.name}: ${data.replyTo.message}`;
    li.appendChild(replyDiv);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const replyBtn = document.createElement('button');
  replyBtn.textContent = 'Reply';
  replyBtn.onclick = () => {
    replyingTo = { id: data.id, name: data.name, message: data.message };
    replyingToText.textContent = `${data.name}: ${data.message.substring(0, 30)}...`;
    replyingToDiv.style.display = 'block';
    msgInput.focus();
  };
  actions.appendChild(replyBtn);

  li.appendChild(actions);
  return li;
}

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
  const li = createMessageElement(data);
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

msgForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = msgInput.value;
  if (message) {
    const payload = { message };
    if (replyingTo) {
      payload.replyTo = { id: replyingTo.id };
      replyingTo = null;
      replyingToDiv.style.display = 'none';
    }
    socket.emit('send-message', payload);
    msgInput.value = '';
  } else if (uploadedImage) {
    const payload = { type: 'image', message: uploadedImage };
    if (document.getElementById('selfDestructBtn').style.display === 'block') {
      payload.selfDestruct = true;
    }
    socket.emit('send-message', payload);
    uploadedImage = null;
    imageOptions.style.display = 'none';
    closeModal.click();
  }
});

cancelReplyBtn.addEventListener('click', () => {
  replyingTo = null;
  replyingToDiv.style.display = 'none';
  msgInput.placeholder = "Type a message...";
});

imageBtn.addEventListener('click', () => {
  imageUpload.click();
});

imageUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('https://3000-alphatheass-locationbas-99o6ynwmkzu.ws-us114.gitpod.io/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Upload failed');

    const { imageUrl } = await response.json();
    uploadedImage = imageUrl;
    //fullImage.src = imageUrl;
    //imageModal.style.display = 'block';
    imageOptions.style.display = 'block';
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Failed to upload image. Please try again.');
  }

  imageUpload.value = ''; // Reset the input
});

closeModal.addEventListener('click', () => {
  imageModal.style.display = 'none';
  imageOptions.style.display = 'none';
  uploadedImage = null;
});

selfDestructBtn.addEventListener('click', () => {
  selfDestructBtn.textContent = 'Self-Destruct Enabled';
  selfDestructBtn.style.backgroundColor = '#28a745';
});