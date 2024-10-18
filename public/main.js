// Initialize socket connection to the server
var socket = io();

// Handle Registration Form submission
document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  
  const response = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    alert('Registration successful! Please log in.');
  } else {
    showError('Registration failed. Username might be taken or server error.');
  }
});

// Handle Login Form submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    startChat(username);  // Start the chat with the logged-in username
  } else {
    showError('Invalid username or password. Please try again.');
  }
});

// Show error messages in the UI
function showError(message) {
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();  // Remove the existing error message before showing a new one
  }

  const errorElement = document.createElement('div');
  errorElement.classList.add('error-message', 'visible');
  errorElement.textContent = message;

// Add error message to the page, below the forms
  const authContainer = document.getElementById('auth-container');
  authContainer.appendChild(errorElement);

// Automatically hide error message after 5 seconds
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

// Chat-related logic
function startChat(username) {
  var form = document.getElementById('form');
  var input = document.getElementById('input');

  // Helper function to sanitize user input (prevent XSS)
  function sanitizeInput(input) {
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Submit form and emit message
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (input.value) {
      // Emit the message along with the username
      socket.emit('chat message', { user: username, message: sanitizeInput(input.value) });
      input.value = '';  // Clear input field
    }
  });

  // Listen for chat messages from the server
  socket.on('chat message', function(data) {
    var item = document.createElement('li');
    // Sanitize message and format for HTML display
    item.innerHTML = `[${data.timestamp}] ${data.user}: ${sanitizeInput(data.message).replace(/\n/g, '<br>')}`;
    document.getElementById('messages').appendChild(item);
    autoScroll();  // Call scrolling function when a new message is added
  });

  // Automatically scroll to the bottom when a new message arrives
  function autoScroll() {
    var messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
  }
}
