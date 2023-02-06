import { describe, expect, it } from "@jest/globals";
import { escapeString, decodeString } from "../utils/stringHelper";

const notEscapedText = `<>"'&`;
const escapedText = `&lt;&gt;&quot;&#39;&amp;`;

describe("stringHelperの単体テスト", () => {
  it("特殊文字が正しくescape文字に変換されること", () => {
    expect(escapeString(notEscapedText)).toBe(escapedText);
  });

  it("escape文字が正しく特殊文字に変換されること", () => {
    expect(decodeString(escapedText)).toBe(notEscapedText);
  });
});
