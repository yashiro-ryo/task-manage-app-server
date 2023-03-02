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

// プロジェクト一覧を返すエンドポイント
app.get("/api/v1/projects", verifyToken, (req: Request, res: Response) => {
  console.log("uid: " + res.locals.uid);
  db.getProject(res.locals.uid)
    .then((projects) => {
      console.log(projects);
      res.status(200).json({ projects });
    })
    .catch((e) => {
      console.log(e);
      res.status(500).json({ msg: "server error" });
    });
});

// プロジェクトを作成するエンドポイント
app.post("/api/v1/project", verifyToken, (req: Request, res: Response) => {
  console.log("uid: " + res.locals.uid);
  db.createProject({
    projectName: req.body.projectName,
    ownerUserId: res.locals.uid,
  })
    .then((projects) => {
      res.status(200).json({
        projects,
      });
    })
    .catch((e) => {
      console.error(e);
      res.status(400).json({
        msg: "Bad Request",
      });
    });
});

// tokenを検証するミドルウエア
function verifyToken(req: Request, res: Response, next: NextFunction) {
  // headerからtokenを取得
  const token = req.headers["authorization"];
  if (token) {
    // token検証
    firebaseAuth
      .verifyFirebaseToken(token)
      .then((decodedToken) => {
        console.log("user id" + decodedToken.uid);
        // 認証成功したので次にuidを渡す
        res.locals.uid = decodedToken.uid;
        next();
      })
      .catch((e) => {
        console.error(e);
        // 認証失敗
        res.status(401).json({ msg: "Unauthorized" });
      });
  } else {
    res.status(400).json({ msg: "Bad Request" });
  }
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
  //console.log("socket.io handshake token : " + token);
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
  const token = socket.handshake.auth.token;
  const projectId = socket.handshake.query.projectId;
  if (projectId === undefined) {
    socket.disconnect();
    return;
  }
  firebaseAuth.verifyFirebaseToken(token).then((decodedToken) => {
    socket.join(projectId);
    socketEvents(socket, decodedToken.uid);
  });
});

function socketEvents(socket: Socket, userId: string) {
  socket
    .on("create-new-task-group", (data: any) => {
      console.log("create new task");
      console.log(data);
      db.createGroup(data.projectId, data.groupName)
        .then(() => {
          console.log("successful create task group");
          sendTasksToClient(data.projectId, io, socket);
        })
        .catch((e: any) => {
          console.log("create group error", e);
        });
    })
    .on("create-task", (data: any) => {
      console.log("create task");
      console.log(data);
      db.createTask(
        data.projectId,
        data.taskGroupId,
        data.taskText,
        data.position
      )
        .then(() => {
          sendTasksToClient(data.projectId, io, socket);
        })
        .catch((e) => {
          console.log(e, "失敗");
        });
    })
    .on("delete-task", (data: any) => {
      console.log("delete task");
      console.log(data);
      db.deleteTask(data.taskId).then(() => {
        sendTasksToClient(data.projectId, io, socket);
      });
    })
    .on("delete-taskgroup", (data: any) => {
      db.deleteTaskGroup(data.taskGroupId).then(() => {
        sendTasksToClient(data.projectId, io, socket);
      });
    })
    .on("get-tasks", (data: any) => {
      console.log("get tasks");
      console.log("userId: ", userId, "projectId: ", data.projectId);
      // 閲覧権限のチェック
      userRights
        .checkUserRights(userId, data.projectId)
        .then(() => {
          sendTasksToClient(data.projectId, io, socket);
        })
        .catch(() => {
          socket.emit("error-invalid-projectId");
        });
    });
}

function sendTasksToClient(projectId: number, io: Server, socket: Socket) {
  console.log("get tasks ", projectId);
  const projectIdStr = String(projectId);
  db.getTasks(projectId)
    .then((taskResults: any) => {
      // ルーム内のユーザー全員に配信
      io.to(projectIdStr).emit("init-tasks", taskResults);
    })
    .catch((e: { errorType: string }) => {
      console.error(e);
      if (e.errorType === "invalid-projectId") {
        // TODO: ioだと接続しているユーザー全てに配信されてしまうので修正する
        socket.emit("error-invalid-projectId");
      } else {
        socket.emit("error");
      }
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
