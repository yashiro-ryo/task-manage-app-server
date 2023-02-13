import express, { Application, Request, Response } from "express";
import session from "express-session";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import db from "./repo/database";
import { auth } from "./auth/auth";
import { token } from "./auth/token";
import fs from "fs";

const app: Application = express();
const PORT = 5050;

const secretKey = fs.readFileSync("keys/private.key");
const sessionOptions = {
  secret: "secret",
  cookie: { maxAge: 60 * 60 * 1000 },
};

app.use(session(sessionOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// clientのcssやjsなどのリソース読み込み用
app.use(express.static("src/client"));
app.use(express.static("src/assets"));
if (process.env.NODE_ENV === "prod") {
  app.use(
    cors({
      origin: "http://160.251.45.134", //アクセス許可するオリジン
      credentials: true, //レスポンスヘッダーにAccess-Control-Allow-Credentials追加
      optionsSuccessStatus: 200, //レスポンスstatusを200に設定
    })
  );
} else {
  app.use(
    cors({
      origin: "http://localhost:3000", //アクセス許可するオリジン
      credentials: true, //レスポンスヘッダーにAccess-Control-Allow-Credentials追加
      optionsSuccessStatus: 200, //レスポンスstatusを200に設定
    })
  );
}

app.get("/home/1", (req: Request, res: Response) => {
  console.log("session id: " + req.session.id);
  res.sendFile(__dirname + "/client/index.html");
});

app.get("/signin", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/assets/html/signin.html");
});

app.get("/signup", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/assets/html/signup.html");
});

app.post("/auth/signin", (req: Request, res: Response) => {
  console.log(req.body);
  console.log("signin user session id: " + req.session.id);
  auth
    .checkEmailAndPass(req.body.userEmail, req.body.userPassHashed)
    .then((userId: number) => {
      console.log("認証成功 :" + userId);
      const tokens = token.createAccessTokenAndRefleshToken({ userId: userId });
      // cookieに格納
      res.send({ result: { hasError: false, errorMsg: "" } });
    })
    .catch((error) => {
      console.error("auth error: " + error.errorType);
      res.send({
        result: { hasError: true, errorMsg: "認証に失敗しました。" },
      });
    });
});

app.post("/auth/signup", (req: Request, res: Response) => {
  console.log(req.body);
  console.log("signup user session id: " + req.session.id);
  auth
    .createUser(req.body.userName, req.body.userEmail, req.body.userPassHashed)
    .then((userId: number) => {
      console.log("crfeated user id = " + userId);
    })
    .catch((err) => {
      if (err.errorType === "this-user-has-already-exist") {
        res.send({
          result: {
            hasError: true,
            errorMsg: "ユーザーがすでに存在します。ログインしてください。",
          },
        });
      } else {
        console.log(err);
        res.send({
          result: {
            hasError: true,
            errorMsg: "予期しないエラーが発生しました。",
          },
        });
      }
    });
});

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
  socket
    .on("create-new-task-group", (data: any) => {
      console.log("create new task");
      console.log(data);
      db.createGroup(data.projectId, data.groupName)
        .then(() => {
          console.log("成功");
          sendTasksToClient(data.projectId, io);
        })
        .catch((e: any) => {
          console.log("create group error", e);
        });
    })
    .on("create-task", (data: any) => {
      console.log("create task");
      console.log(data);
      createTask(
        data.projectId,
        data.taskGroupId,
        data.taskText,
        data.position
      );
    })
    .on("delete-task", (data: any) => {
      console.log("delete task");
      console.log(data);
      db.deleteTask(data.taskId).then(() => {
        sendTasksToClient(data.projectId, io);
      });
    })
    .on("delete-taskgroup", (data: any) => {
      db.deleteTaskGroup(data.taskGroupId).then(() => {
        sendTasksToClient(data.projectId, io);
      });
    })
    .on("get-tasks", (data: any) => {
      console.log("get tasks");
      sendTasksToClient(data.projectId, io);
    });
});

function sendTasksToClient(projectId: number, io: Server) {
  db.getTasks(projectId)
    .then((taskResults: any) => {
      console.log("成功");
      console.log(taskResults);
      io.emit("init-tasks", taskResults);
    })
    .catch((e: { errorType: string }) => {
      console.error(e);
      if (e.errorType === "invalid-projectId") {
        // TODO: ioだと接続しているユーザー全てに配信されてしまうので修正する
        io.emit("error-invalid-projectId");
      } else {
        io.emit("error");
      }
    });
}

function createTask(
  projectId: number,
  taskGroupId: number,
  taskText: string,
  taskPosition: number
) {
  db.createTask(projectId, taskGroupId, taskText, taskPosition)
    .then(() => {
      sendTasksToClient(projectId, io);
    })
    .catch((e) => {
      console.log(e, "失敗");
    });
}

try {
  server.listen(PORT, () => {
    console.log(`dev server running at: http://localhost:${PORT}/`);
  });
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message);
  }
}
