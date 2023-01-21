import { describe, expect, it } from "@jest/globals";
import db from "../repo/database";

describe("database.ts createConfigテスト", () => {
  it("dev環境時に正しいDBの接続先に設定されること", () => {
    process.env.NODE_ENV = "dev";
    expect(db.createConfig()).toStrictEqual({
      host: "localhost",
      user: "root",
      password: process.env.DEV_DB_PASS,
      database: "task_manage_app",
    });
  });

  it("prod環境時に正しいDBの接続先に設定されること", () => {
    process.env.NODE_ENV = "prod";
    expect(db.createConfig()).toStrictEqual({
      host: "****",
      user: "****",
      password: process.env.PROD_DB_PASS,
      database: "****",
    });
  });

  it("予期市内環境が指定された際にはnullが帰ること", () => {
    process.env.NODE_ENV = "hogehoge";
    expect(db.createConfig()).toBe(null);
  });
});
