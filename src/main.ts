import express, { Application, Request, Response, NextFunction } from "express";
import session, { Session } from "express-session";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import db from "./repo/database";
import { userRights } from "./auth/userAccessRights";
import { firebaseAuth } from "./auth/firebaseAuth";

declare module "http" {
  interface IncomingMessage {
    session: Session & {
      authenticated: boolean;
    };
  }
}

const app: Application = express();
const PORT = 5050;

const sessionOptions = {
  secret: "secret",
  cookie: { maxAge: 60 * 60 * 1000 },
};

const sessionMiddleware = session(sessionOptions);

app.use(sessionMiddleware);

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

app.get("/home/:projectId", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/client/index.html");
});

app.get("/home", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/client/index.html");
});

app.get("/signin", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/assets/html/signin.html");
});

app.get("/signup", (req: Request, res: Response) => {
  res.sendFile(__dirname + "/assets/html/signup.html");
});

app.get("/api/v1/projects", verifyToken, (req: Request, res: Response) => {
  console.log("session id: " + req.session.id);
});

app.post("/api/v1/project", verifyToken, (req: Request, res: Response) => {
  console.log("session id: " + req.session.id);
});

function verifyToken(req: Request, res: Response, next: NextFunction) {
  // headerからtokenを取得
  const authHeader = req.headers["authorization"];
  if (authHeader === undefined) {
    return;
  }
  const bearerToken = authHeader.split(" ");
  const token = bearerToken[1];
  // token検証
  firebaseAuth
    .verifyFirebaseToken(token)
    .then((decodedToken) => {
      console.log("user id" + decodedToken.uid);
    })
    .catch((e) => {
      console.error(e);
    });
  next();
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    credentials: true,
  },
});

io.use((socket, next) => {
  sessionMiddleware(
    socket.request as Request,
    {} as Response,
    next as NextFunction
  );
  const token = socket.handshake.auth.token;
  console.log("socket.io handshake token : " + token);
  // token認証
  firebaseAuth
    .verifyFirebaseToken(token)
    .then((decodedToken) => {
      console.log(decodedToken.uid);
      // 認証成功
      next();
    })
    .catch((e) => {
      console.error(e);
      // 認証失敗
      socket.disconnect();
    });
});

//クライアントと通信
io.on("connection", (socket) => {
  console.log("a user connected");
  console.log(socket.request.session.id);
  socketEvents(socket, 1);
});

function socketEvents(socket: Socket, userId: number) {
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
      console.log("userId: ", userId, "projectId: ", data.projectId);
      // 閲覧権限のチェック
      userRights
        .checkUserRights(userId, data.projectId)
        .then(() => {
          sendTasksToClient(data.projectId, io);
        })
        .catch(() => {
          socket.emit("error-invalid-projectId");
        });
    });
}

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
