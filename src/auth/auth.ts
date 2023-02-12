import mysql from "mysql2/promise";
import db from "../repo/database";

class Auth {
  con: mysql.Connection | undefined;
  constructor() {
    this.createConnection();
  }

  async createConnection() {
    const config = db.createConfig();
    if (config === null) {
      console.error("failed create db configure");
      return Promise.reject({ errorType: "failed-create-db-configure" });
    }
    this.con = await mysql.createConnection(config);
    return Promise.resolve();
  }

  async checkEmailAndPass(email: string, passHashed: string) {
    if (this.con === undefined) {
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }
    const [users]: any = await this.con.query(
      `select user_id from user where (user_email = '${email}' and user_pass_hashed = '${passHashed}');`
    );
    if (users.length === 0) {
      return Promise.reject({ errorType: "cannot-find-user" });
    } else if (users.length > 1) {
      return Promise.reject({ errorType: "matched-many-user" });
    } else {
      return Promise.resolve(users[0].user_id);
    }
  }
}

export const auth = new Auth();
