import { v4 as uuid } from "uuid"
import { io } from "./host.js"
import { getReports } from "./functions.js"
import { context } from "./context.js"
import { pool } from "./db.js"

export const executeUserInput = async (input, socket) => {
  try {
    const command = input.command

    if (command.charAt(0) === "m") {
      io.emit("event", {
        message: `Server: ${command.substring(2)}`,
      })
    } else if (command == "lockall") {
      io.emit("event", {
        message: "Chat has been locked",
        status: 1,
      })
      console.log("🔒 All chats locked!")

      context.LOCKED = true
    } else if (command == "unlockall") {
      io.emit("event", {
        message: "Chat has been unlocked",
      })
      console.log("🔓 All chats unlocked!")

      context.LOCKED = false
    } else if (command == "refresh") io.emit("reload", "")
    else if (command == "purge") {
      await pool.execute("DELETE FROM rooms WHERE is_private = 0")
      io.emit("purge")
    } else if (command == "deletemsg") {
      console.log(input)
      await pool.execute(
        "DELETE FROM messages WHERE message_uuid = ? AND room_id = ?",
        [input.msgid, input.roomid]
      )

      io.to(input.roomid).emit("delete", {
        type: "message",
        id: input.msgid,
      })
    } else if (command == "deleteroom") {
      await pool.execute("DELETE FROM rooms WHERE room_uuid = ?", [
        input.roomid,
      ])

      io.to("home").emit("delete", {
        type: "room",
        id: input.roomid,
      })
    } else if (command == "highlight") {
      if (!input.roomid) return

      if (input.message) {
        const id = uuid()
        await pool.execute(
          "INSERT INTO messages (message_uuid, room_id, user_id, content, is_highlighted) VALUES (?, ?, ?, ?, true)",
          [id, input.roomid, "system", input.message]
        )

        io.to(input.roomid).emit("message", {
          message: input.message,
          id,
          highlight: true,
        })
      } else {
        await pool.execute(
          "UPDATE rooms SET is_highlighted = true WHERE room_uuid = ?",
          [input.roomid]
        )

        const [rows] = await pool.execute(
          "SELECT room_uuid, name as title FROM rooms WHERE room_uuid = ?",
          [input.roomid]
        )

        if (rows.length > 0) {
          io.to("home").emit("room", {
            title: rows[0].title,
            id: rows[0].room_uuid,
            highlight: true,
            update: true,
          })
        }
      }
    } else if (command == "joinreports") {
      socket.emit("joined", "reports")
      getReports(socket)
    } else {
      console.log("❌ An invalid command was provided:", command)
    }
  } catch (error) {
    console.warn("❌ Error!", error)
  }
}
