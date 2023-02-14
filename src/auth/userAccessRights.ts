import mysql from "mysql2/promise";
import db from "../repo/database";

class UserAccessRights {
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

  async getUserProjects(userId: number) {
    if (this.con === undefined) {
      return Promise.reject({ errorType: "failed-initialize-connection" });
    }
    const [projects]: any = await this.con.query(
      `select project_id from user_access_rights where user_id = ${userId};`
    );

    if (projects.length === 0) {
      return Promise.resolve([]);
    }

    const projectInfos = [];
    for (let i = 0; i < projects.length; i++) {
      const [projectInfo]: any = await this.con.query(
        `select * from project where project_id = ${projects[i].project_id};`
      );
      projectInfos.push({
        projectId: projectInfo[0].project_id,
        projectName: projectInfo[0].project_name,
      });
    }
    return Promise.resolve(projectInfos);
  }
}

export const userRights = new UserAccessRights();
