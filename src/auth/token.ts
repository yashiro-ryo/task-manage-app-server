import * as jwt from "jsonwebtoken";
import * as fs from "fs";

type Payload = {
  userId: number;
};

class Token {
  ACCESS_TOKEN_EXPIRED = 60 * 1; // access token の有効期限は1時間
  REFLESH_TOKEN_EXPIRED = 60 * 6; // reflesh token の有効期限は6時間
  SECRET_KEY;
  constructor() {
    this.SECRET_KEY = fs.readFileSync("keys/private.key");
  }

  createToken(payload: Payload, tokenType: "access" | "reflesh") {
    let tokenExpired;
    if (tokenType === "access") {
      tokenExpired = this.ACCESS_TOKEN_EXPIRED;
    } else {
      tokenExpired = this.REFLESH_TOKEN_EXPIRED;
    }
    const token = jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: tokenExpired,
      algorithm: "RS256",
    });
    return token;
  }

  createAccessTokenAndRefleshToken(payload: Payload) {
    const accessToken = this.createToken(payload, "access");
    const refleshToken = this.createToken(payload, "reflesh");
    return {
      accessToken: accessToken,
      refleshToken: refleshToken,
    };
  }

  async verifyToken(token: string) {
    return await jwt.verify(token, this.SECRET_KEY, (error: any, _) => {
      if (error) {
        return Promise.reject({ errorType: "failed-verify-token" });
      } else {
        return Promise.resolve();
      }
    });
  }
}

export const token = new Token();
