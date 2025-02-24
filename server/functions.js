import { context } from "./context.js"
import { pool } from "./db.js"

export const password = async () => {
  try {
    // Check if admin password exists
    const [rows] = await pool.execute(
      "SELECT password FROM admin_settings WHERE id = 1"
    )

    if (rows.length > 0) {
      context.PASSWORD = rows[0].password
    } else {
      // If no password exists, insert the default one from context
      await pool.execute("INSERT INTO admin_settings (password) VALUES (?)", [
        context.PASSWORD,
      ])
    }
  } catch (error) {
    console.warn("❌ Error managing admin password:", error)
  }
}

export const getroom = async (socket) => {
  const [rooms] = await pool.execute(
    "SELECT room_uuid as id, name as title FROM rooms WHERE is_private = 0"
  )

  for (const room of rooms) {
    socket.emit("room", {
      title: room.title,
      id: room.id,
    })
  }
}

export const get = async (socket, id) => {
  try {
    const [messages] = await pool.execute(
      "SELECT message_uuid as id, content as message, is_highlighted FROM messages WHERE room_id = ? ORDER BY created_at ASC",
      [id]
    )

    for (const message of messages) {
      console.log(message)
      socket.emit("message", {
        msgid: message.id,
        message: message.message,
        highlight: message.is_highlighted,
      })
    }
  } catch (error) {
    console.warn("❌ Error fetching messages:", error)
  }
}

export const getReports = async (socket) => {
  try {
    const [reports] = await pool.execute(
      `SELECT 
        message_uuid as msgid,
        room_uuid as roomid,
        message_content as message,
        reported_at as time
      FROM reports
      ORDER BY reported_at DESC`
    )

    for (const report of reports) {
      socket.emit("report", {
        msgid: report.msgid,
        roomid: report.roomid,
        message: report.message,
        time: report.time,
      })
    }
  } catch (error) {
    console.warn("❌ Error fetching reports:", error)
  }
}
