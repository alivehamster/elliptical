import "dotenv/config"
import { v4 as uuid } from "uuid"
import { createInterface } from "node:readline"
import { io, server } from "./server/host.js"
import { executeUserInput } from "./server/adminhandler.js"
import { get, getroom } from "./server/functions.js"
import { context } from "./server/context.js"
import { pool } from "./server/db.js"

// Handle socket.io events
io.on("connection", async (socket) => {
  console.log("📥 New user connected with id", socket.id)

  socket.join("home")
  context.ONLINE++
  io.emit("users", context.ONLINE)
  getroom(socket)

  socket.on("message", async ({ roomid, message }) => {
    const filtermsgspace = message.replaceAll(" ", "")
    const filtermsgcaps = filtermsgspace.toLowerCase()
    const messageIncludesBlockedTerm = context.BLOCKED.some((term) =>
      filtermsgcaps.includes(term)
    )

    // Emit a warning or take other appropriate action
    if (messageIncludesBlockedTerm)
      socket.emit("event", {
        message: "Message contains a blocked phrase",
        status: 2,
      })
    else if (context.LOCKED)
      socket.emit("event", {
        message: "Chat has been locked",
        status: 1,
      })
    else {
      if (message.length >= 200) {
        socket.emit("event", {
          message: "Too many characters in message (200 max)",
          status: 2,
        })
      } else {
        const id = uuid()

        const [result] = await pool.execute(
          "INSERT INTO messages (room_id, user_id, content, message_uuid) VALUES (?, ?, ?, ?)",
          [roomid, socket.id, message, id]
        )

        io.emit("message", {
          message,
          id,
        })
      }
    }
  })

  socket.on("room", async (room) => {
    if (typeof room.title !== "string") return

    const messageIncludesBlockedTerm = context.BLOCKED.some((term) =>
      room.title.replaceAll(" ", "").toLowerCase().includes(term)
    )
    const [rows] = await pool.execute(
      "SELECT COUNT(*) as count FROM rooms WHERE is_private = 0"
    )
    const roomCount = rows[0].count

    if (messageIncludesBlockedTerm)
      socket.emit("event", {
        message: "Room name contains a blocked phrase",
        status: 2,
      })
    else if (context.LOCKED == true)
      socket.emit("event", {
        message: "Chat has been locked",
        status: 1,
      })
    else if (roomCount >= context.MAX_ROOMS)
      socket.emit("event", {
        message: "Too many rooms",
        status: 2,
      })
    else {
      if (room.title.length >= 25)
        socket.emit("event", {
          message: "Too many characters in room name (25 max)",
          status: 2,
        })
      else {
        const id = uuid()

        const [result] = await pool.execute(
          "INSERT INTO rooms (room_uuid, name, is_private, access_code) VALUES (?, ?, ?, ?)",
          [
            id,
            room.title,
            room.private && !!room.code ? 1 : 0,
            room.code || null,
          ]
        )

        if (room.private && room.code)
          socket.emit("room", {
            title: room.title,
            code: room.code,
            private: true,
            id,
          })
        else
          io.to("home").emit("room", {
            title: room.title,
            id,
          })
      }
    }
  })

  socket.on("join private", async (code) => {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM rooms WHERE access_code = ?",
        [code]
      )

      if (rows.length > 0) {
        const room = rows[0]
        socket.emit("room", {
          title: room.name,
          id: room.room_uuid,
          private: true,
          code: room.access_code,
        })
      }
    } catch {} // Room does not exist
  })

  socket.on("join", async (id) => {
    try {
      console.log(id)
      socket.join(id)
      socket.emit("joined", id)
      get(socket, id)
    } catch (e) {
      console.warn("❌ Error!", e)
    }
  })

  socket.on("disconnect", () => {
    context.ONLINE--

    io.emit("users", context.ONLINE)
  })

  socket.on("report msg", async (msg) => {
    try {
      // Check if report already exists
      const [existing] = await pool.execute(
        "SELECT id FROM reports WHERE message_uuid = ? AND room_uuid = ?",
        [msg.msgid, msg.roomid]
      )

      if (existing.length === 0) {
        await pool.execute(
          "INSERT INTO reports (message_uuid, room_uuid, message_content, reported_at) VALUES (?, ?, ?, NOW())",
          [msg.msgid, msg.roomid, msg.message]
        )
        console.log("📝 New report added:", msg)
      }

      socket.emit("event", {
        message: "Message reported",
      })
    } catch (error) {
      console.error("❌ Error handling report:", error)
    }
  })

  socket.on("admin handler", (msg) => {
    if (msg.adminpass.includes(context.PASSWORD)) executeUserInput(msg, socket)
    else console.log("❌ Invalid admin password attempt: " + msg.adminpass)
  })

  socket.on("passchange", async (msg) => {
    if (msg.adminpass.includes(context.PASSWORD)) {
      await pool.execute("UPDATE admin_settings SET password = ?", [
        msg.newpass,
      ])

      context.PASSWORD = msg.newpass
      socket.emit("event", {
        message: "Success",
      })

      console.log("✅ Password changed to: " + msg.newpass)
    } else console.log("❌ Invalid admin password attempt: " + msg.adminpass)
  })

  socket.on("updateMaxRooms", (msg) => {
    if (msg.adminpass.includes(context.PASSWORD)) {
      context.MAX_ROOMS = msg.maxRooms

      socket.emit("event", {
        message: "Success",
      })

      console.log("✅ Max rooms updated to: " + context.MAX_ROOMS)
    } else console.log("❌ Invalid admin password attempt: " + msg.adminpass)
  })
})

// Start the server
server.listen(3000, () =>
  console.log("✅ Elliptical server running at http://localhost:3000")
)

// Create a simple command line interface for executing commands
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

const command = () =>
  rl.question("✅ Ready for chat commands\n", (input) => {
    executeUserInput({ command: input }) // Execute your function
    command()
  })

command()
