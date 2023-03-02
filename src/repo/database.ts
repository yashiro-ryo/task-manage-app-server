import mysql from "mysql2/promise";
import "dotenv/config";
import { escapeString, decodeString } from "../utils/stringHelper";

function createConfig() {
  console.log("環境", process.env.NODE_ENV);
  if (process.env.NODE_ENV === "dev") {
    // development
    console.log("config :", {
      host: process.env.DEV_DB_HOST,
      user: process.env.DEV_DB_USER,
      database: process.env.DEV_DB_DATABASE,
      password: process.env.DEV_DB_PASS,
    });
    return {
      host: process.env.DEV_DB_HOST,
      user: process.env.DEV_DB_USER,
      database: process.env.DEV_DB_DATABASE,
      password: process.env.DEV_DB_PASS,
    };
  } else if (process.env.NODE_ENV === "prod") {
    // production
    return {
      host: process.env.PROD_DB_HOST,
      user: process.env.PROD_DB_USER,
      database: process.env.PROD_DB_DATABASE,
      password: process.env.PROD_DB_PASS,
    };
  } else {
    // other
    return null;
  }
}

async function getTasks(projectId: number) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    // configが正しく表示できない場合はエラー
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  // project の内容を取得
  const [getProjectInfoResult]: any = await con.query(
    `select * from projects where project_id = ${projectId}`
  );
  console.log(getProjectInfoResult);
  if (getProjectInfoResult.length !== 1) {
    return Promise.reject({ errorType: "invalid-projectId" });
  }
  const projectName = getProjectInfoResult[0].project_name;
  // task groupの取得
  const [getTaskGroupResult]: any = await con.query(
    `select * from task_group where project_id = ${projectId}`
  );
  console.log(getTaskGroupResult);
  if (getTaskGroupResult.length < 1) {
    return Promise.resolve([]);
  }
  // taskの取得と結果オブジェクトの生成
  const taskResults = [];
  for (let i = 0; i < getTaskGroupResult.length; i++) {
    let [getTaskResult]: any = await con.query(
      `select * from task where task_group_id = ${getTaskGroupResult[i].task_group_id} order by task_position asc`
    );
    // migrate keys
    console.log(getTaskResult);
    getTaskResult = getTaskResult.map((value: any) => {
      return {
        taskId: value.task_id,
        taskText: decodeString(value.task_name),
        taskGroupId: value.task_group_id,
        taskPosition: value.task_position,
        taskCreatedAt: "2000/09/15",
        taskPriority: "low",
      };
    });
    taskResults.push({
      taskGroupId: getTaskGroupResult[i].task_group_id,
      taskGroupText: decodeString(getTaskGroupResult[i].task_group_name),
      tasks: getTaskResult,
    });
  }
  console.log(taskResults);
  return Promise.resolve(taskResults);
}

async function createGroup(projectId: number, groupName: string) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    // configが正しく表示できない場合はエラー
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  const t = escapeString(groupName);
  con.query(`insert into task_group values (null, '${t}', ${projectId})`);
}

async function createTask(
  projectId: number,
  taskGroupId: number,
  taskText: string,
  taskPosition: number
) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  const t = escapeString(taskText);
  con.query(
    `insert into task value (null, ${taskGroupId}, '${t}', ${taskPosition})`
  );
}

async function deleteTask(taskId: number) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  con.query(`delete from task where task_id = ${taskId}`);
}

async function deleteTaskGroup(taskGroupId: number) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  con.query(`delete from task_group where task_group_id = ${taskGroupId}`);
}

type ProjectInfo = {
  projectName: string;
  ownerUserId: string;
};

async function createProject(newProjectInfo: ProjectInfo) {
  // db接続
  const dbConfig = createConfig();
  if (dbConfig === null) {
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  // 被らない数値を生成するために日時を利用する
  const date = new Date();
  const datetimeStr = date.toLocaleString();
  // プロジェクトの情報をDBに登録する
  await con.query(
    `insert into projects value (null, '${newProjectInfo.projectName}', '${newProjectInfo.ownerUserId}', '${datetimeStr}');`
  );
  // プロジェクトIdを取得する
  const [project]: any = await con.query(
    `select project_id from projects where (owner_user_id = '${newProjectInfo.ownerUserId}' and unique_str = '${datetimeStr}');`
  );
  // アクセス権限テーブルに記録する
  await con.query(
    `insert into user_access_right value ('${newProjectInfo.ownerUserId}', ${project[0].project_id})`
  );
  const [projects]: any = await con.query(
    `select * from projects where project_id = ${project[0].project_id}`
  );
  return projects;
}

async function getProject(uid: string) {
  // db接続
  const dbConfig = createConfig();
  if (dbConfig === null) {
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  const [canShowProjects]: any = await con.query(
    `select * from user_access_right where user_id = '${uid}';`
  );
  console.log(canShowProjects);
  const query = `select * from projects where `;
  let queryParts = "";
  for (let i = 0; i < canShowProjects.length; i++) {
    queryParts += `project_id = ${canShowProjects[i].project_id}`;
    if (canShowProjects.length > 0 && i !== canShowProjects.length - 1) {
      queryParts += ` or `;
    }
  }
  const [projects]: any = await con.query(query + queryParts + ";");
  return projects;
}

export default {
  createConfig,
  getTasks,
  createGroup,
  createTask,
  deleteTask,
  deleteTaskGroup,
  createProject,
  getProject,
} as const;
