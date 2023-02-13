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

  async createUser(name: string, email: string, passHashed: string) {
    if (this.con === undefined) {
      console.error("failed-initialize-connection");
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }
    const [users]: any = await this.con.query(
      `select * from user where user_email = '${email}'`
    );
    if (users.length !== 0) {
      console.error("this-user-has-already-exist");
      return Promise.reject({ errorType: "this-user-has-already-exist" });
    }
    // create user
    await this.con.query(
      `insert into user (user_id, user_name, user_email, user_pass_hashed) value (null, '${name}', '${email}', '${passHashed}');`
    );
    const [user]: any = await this.con.query(
      `select user_id from user where (user_email = '${email}' and user_pass_hashed = '${passHashed}' and user_name = '${name}');`
    );
    console.log(user);
    return Promise.resolve(user[0].user_id);
  }

  async saveTokenAndSessionId(
    accessToken: string,
    refleshToken: string,
    sessionId: string
  ) {
    if (this.con === undefined) {
      console.error("failed-initialize-connection");
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }
    await this.con.query(
      `insert into session_token (access_token, reflesh_token, session_id) value ('${accessToken}', '${refleshToken}', '${sessionId}');`
    );
    return Promise.resolve();
  }
}

export const auth = new Auth();
