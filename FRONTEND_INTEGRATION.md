# Frontend Integration

## 1. Authenticate

Create an account or log in through `/api/auth/signup` or `/api/auth/login`. Store the returned JWT and user object.

Send the token on protected REST requests:

```ts
fetch(`${API_URL}/api/rooms`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ title, videoUrl })
});
```

## 2. Connect Socket.IO

```ts
const socket = io(API_URL, {
  auth: { token },
  transports: ["websocket", "polling"]
});
```

The backend verifies the JWT during the Socket.IO handshake and uses the account name as the room display name.

## 3. Join a room

```ts
socket.emit("join_room", {
  roomId,
  username: user.name,
  hostToken,
  sessionToken
}, (response) => {
  if (!response.ok) throw new Error(response.error.message);
  localStorage.setItem(`syncroom-session:${roomId}`, response.data.sessionToken);
});
```

## 4. Permissions

The UI can hide controls based on the returned role, but the backend always validates Host, Moderator and Participant permissions independently.
