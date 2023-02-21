import mysql from "mysql2/promise";
import db from "../repo/database";
import { token } from "./token";

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
    sessionId: string,
    userId: number
  ) {
    if (this.con === undefined) {
      console.error("failed-initialize-connection");
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }
    const [userTokens]: any = await this.con.query(
      `select user_id from session_token where user_id = ${userId}`
    );
    if (userTokens.length === 0) {
      await this.con.query(
        `insert into session_token (user_id, access_token, reflesh_token, session_id) value (${userId}, '${accessToken}', '${refleshToken}', '${sessionId}');`
      );
    } else {
      await this.con.query(
        `update session_token set user_id = ${userId} , access_token = '${accessToken}', reflesh_token = '${refleshToken}', session_id = '${sessionId}' where user_id = ${userId};`
      );
    }
    return Promise.resolve();
  }

  async checkSessionId(sessionId: string) {
    if (this.con === undefined) {
      console.error("failed-initialize-connection");
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }

    const [tokens]: any = await this.con.query(
      `select user_id, access_token, reflesh_token from session_token where session_id = '${sessionId}'`
    );

    if (tokens.length === 0) {
      return Promise.reject({ errorType: "doesnot-exist-sessionId" });
    }

    return token
      .verifyToken(tokens[0].access_token)
      .then(() => {
        // トークンにてログイン完了
        console.log("sucessful signin with access token");
        return Promise.resolve(tokens[0].user_id);
      })
      .catch((e) => {
        if (e.errorType === "token-is-expired") {
          console.log("token is expired");
          // reflesh tokenの検証
          return token
            .verifyToken(tokens[0].reflesh_token)
            .then(() => {
              console.log("create new token");
              // 新しいトークンの発行
              const newTokens = token.createAccessTokenAndRefleshToken({
                userId: tokens[0].user_id,
              });
              // 新しいトークンをDBに保存する
              this.saveTokenAndSessionId(
                newTokens.accessToken,
                newTokens.refleshToken,
                sessionId,
                tokens[0].user_id
              )
                .then(() => {
                  // ログイン完了とする
                  console.log("successful signin with reflesh token");
                  return Promise.resolve(tokens[0].user_id);
                })
                .catch((e) => {
                  // ログアウト
                  return Promise.reject({
                    errorType: "failed-authenticate-user",
                  });
                });
            })
            .catch((e) => {
              console.error("reflesh token is not verified");
              // ログアウト
              return Promise.reject({ errorType: "failed-authenticate-user" });
            });
        } else {
          // ログアウト
          return Promise.reject({ errorType: "failed-authenticate-user" });
        }
      });
  }

  async doSignout(sessionId: string) {
    console.log("do signout");
    if (this.con === undefined) {
      console.error("failed-initialize-connection");
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }

    this.con.query(`delete from session_token where session_id = '${sessionId}'`)
    return Promise.resolve();
  }
}

export const auth = new Auth();
