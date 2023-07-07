import { Server, type Socket } from 'socket.io'
import { z } from 'zod'

import type { JoinRoomData } from './types'
import { joinRoomSchema } from './lib/validations/joinRoom'
import { addUser, getRoomMembers, removeUser } from './data/users'

const express = require('express')
const http = require('http')
const cors = require('cors')

const app = express()

app.use(cors())

const server = http.createServer(app)

const io = new Server(server)

function isRoomCreated(roomId: string) {
  const rooms = [...io.sockets.adapter.rooms]
  return rooms?.some(room => room[0] === roomId)
}

function validateJoinRoomData(socket: Socket, joinRoomData: JoinRoomData) {
  try {
    return joinRoomSchema.parse(joinRoomData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      socket.emit('invalid-data', {
        message: 'The entities you provided are not correct and cannot be processed.',
      })
    }
  }
}

function joinRoom(socket: Socket, roomId: string, username: string) {
  socket.join(roomId)
  const user = {
    id: socket.id,
    username,
  }
  addUser({ ...user, roomId })
  const members = getRoomMembers(roomId)
  socket.emit('room-joined', { user, roomId, members })
}

io.on('connection', socket => {
  socket.on('create-room', (joinRoomData: JoinRoomData) => {
    const validatedData = validateJoinRoomData(socket, joinRoomData)

    if (!validatedData) return
    const { roomId, username } = validatedData

    joinRoom(socket, roomId, username)
  })

  socket.on('join-room', (joinRoomData: JoinRoomData) => {
    const validatedData = validateJoinRoomData(socket, joinRoomData)

    if (!validatedData) return
    const { roomId, username } = validatedData

    if (isRoomCreated(roomId)) {
      return joinRoom(socket, roomId, username)
    }

    socket.emit('room-not-found', {
      message: "Oops! The Room ID you entered doesn't exist or hasn't been created yet.",
    })
  })

  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId)
    removeUser(socket.id)
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => console.log(`Server is running on port ${PORT} now!`))