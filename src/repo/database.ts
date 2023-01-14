import mysql from "mysql2/promise";
import 'dotenv/config'

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
    throw new Error();
  }
  const con = await mysql.createConnection(dbConfig);
  console.log(con)
}

export default {
  getTasks,
} as const;
