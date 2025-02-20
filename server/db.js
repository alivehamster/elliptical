import mysql from "mysql2/promise"

/**
 * Ensures that the database and required tables are created if they do not exist.
 * Connects to the MySQL database using the provided environment variables.
 * Creates the database and tables if they do not exist.
 * Logs the status of the operations.
 * Closes the connection after the operations are complete.
 *
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */

const db_config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "elliptical".replace(/[^a-zA-Z0-9_]/g, ""),
}

export async function ensuredb() {
  let connection
  try {
    connection = await mysql.createConnection({
      host: db_config.host,
      user: db_config.user,
      password: db_config.password,
    })
    await connection.query("CREATE DATABASE IF NOT EXISTS ??", [
      db_config.database,
    ])
    await connection.query("USE ??", [db_config.database])
    console.log("Database ensured.")

    // await connection.query(`
    //   CREATE TABLE IF NOT EXISTS accounts (
    //     id INT AUTO_INCREMENT PRIMARY KEY,
    //     username VARCHAR(255) NOT NULL UNIQUE,
    //     hashed_password VARCHAR(255) NOT NULL
    //   );
    // `);
    // console.log("Table 'accounts' ensured.");
    // Create rooms table

    await connection.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        is_private BOOLEAN DEFAULT FALSE,
        access_code VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log("Table 'rooms' ensured.")

    // Create messages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_uuid VARCHAR(36) NOT NULL UNIQUE,
        room_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(room_uuid) ON DELETE CASCADE
      );
    `);
    console.log("Table 'messages' ensured.")

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_uuid VARCHAR(36) NOT NULL,
        room_uuid VARCHAR(36) NOT NULL,
        message_content TEXT NOT NULL,
        reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        password VARCHAR(255) NOT NULL UNIQUE
      );
    `);
  } catch (err) {
    console.error("Error ensuring database and table:", err)
  } finally {
    if (connection) await connection.end()
  }
}

export const pool = mysql.createPool({
  host: db_config.host,
  user: db_config.user,
  password: db_config.password,
  database: db_config.database,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 40,
})
