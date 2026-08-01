# SyncRoom Watch Party Backend

Express + Socket.IO + TypeScript backend with MongoDB persistence and JWT authentication.

## Features

- User signup, login and current-user APIs
- Unique normalized email addresses
- bcrypt password hashing
- JWT bearer authentication
- Login/signup rate limiting
- Protected room REST endpoints and Socket.IO connections
- MongoDB users, rooms, playback, participants, roles, sessions and chat history
- Host, Moderator and Participant permissions
- Play, pause, seek and video-change synchronization
- Role assignment, participant removal and host transfer
- Automatic host succession and reconnect grace period
- Zod validation, Helmet, CORS and HTTP rate limiting
- Docker and Render configuration

## Local setup

```bash
docker compose up -d mongodb
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:4000`

## Authentication API

### Signup

`POST /api/auth/signup`

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "strong-password"
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "alex@example.com",
  "password": "strong-password"
}
```

Both endpoints return:

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "user-id",
      "name": "Alex Morgan",
      "email": "alex@example.com",
      "createdAt": "2026-07-30T00:00:00.000Z"
    },
    "token": "jwt-access-token"
  }
}
```

### Current user

`GET /api/auth/me`

Send:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Room API

All room routes require the same `Authorization` header.

### Create a room

`POST /api/rooms`

```json
{
  "title": "Friday Movie Night",
  "videoUrl": "https://www.youtube.com/watch?v=LXb3EKWsInQ"
}
```

### Check a room

`GET /api/rooms/:roomId`

## Authenticated Socket.IO connection

Pass the JWT in the Socket.IO handshake:

```ts
const socket = io(API_URL, {
  auth: { token },
  transports: ["websocket", "polling"]
});
```

Then emit `join_room`. The server uses the verified JWT name and user ID rather than trusting an arbitrary display name.

```ts
socket.emit("join_room", { roomId, username, hostToken, sessionToken }, callback);
```

## Role enforcement

- **Host:** all controls, role management, removals and host transfer
- **Moderator:** playback, seek and video changes
- **Participant:** watch, synchronize and chat only

## Production variables

```env
NODE_ENV=production
PORT=4000
FRONTEND_ORIGIN=https://your-frontend-domain.com
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=syncroom_watch_party
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d
ROOM_TTL_MINUTES=360
MAX_PARTICIPANTS_PER_ROOM=50
```

For horizontal scaling, add Redis and the Socket.IO Redis adapter so all backend instances share broadcasts and active-room coordination.
