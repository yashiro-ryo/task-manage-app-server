import express, { Application } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import db from './repo/database'

const app: Application = express();
const PORT = 5050;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000", //アクセス許可するオリジン
    credentials: true, //レスポンスヘッダーにAccess-Control-Allow-Credentials追加
    optionsSuccessStatus: 200, //レスポンスstatusを200に設定
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    credentials: true,
  },
});

//クライアントと通信
io.on("connection", (socket) => {
  console.log("a user connected");
  console.log(socket);
  socket.emit("msg", "ping");
  db.getTasks(1)
});

try {
  server.listen(PORT, () => {
    console.log(`dev server running at: http://localhost:${PORT}/`);
  });
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message);
  }
}
