import mysql from "mysql2/promise";
import "dotenv/config";

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
    `select * from project where project_id = ${projectId}`
  );
  console.log(getProjectInfoResult);
  if (getProjectInfoResult.length !== 1) {
    throw new Error("cannot found project info");
  }
  const projectName = getProjectInfoResult[0].project_name;
  // task groupの取得
  const [getTaskGroupResult]: any = await con.query(
    `select * from task_group where project_id = ${projectId}`
  );
  console.log(getTaskGroupResult);
  if (getTaskGroupResult.length < 1) {
    throw new Error("cannot found task group");
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
        taskText: value.task_name,
        taskGroupId: value.task_group_id,
        taskPosition: value.task_position,
        taskCreatedAt: "2000/09/15",
        taskPriority: "low",
      };
    });
    taskResults.push({
      taskGroupId: getTaskGroupResult[i].task_group_id,
      taskGroupText: getTaskGroupResult[i].task_group_name,
      tasks: getTaskResult,
    });
  }
  console.log(taskResults);
  return taskResults;
}

async function createGroup(projectId: number, groupName: string) {
  const dbConfig = createConfig();
  if (dbConfig === null) {
    // configが正しく表示できない場合はエラー
    throw new Error("cannot create config file");
  }
  const con = await mysql.createConnection(dbConfig);
  con.query(
    `insert into task_group values (null, '${groupName}', ${projectId})`
  );
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
  con.query(
    `insert into task value (null, ${taskGroupId}, '${taskText}', ${taskPosition})`
  );
}

export default {
  getTasks,
  createGroup,
  createTask,
} as const;
