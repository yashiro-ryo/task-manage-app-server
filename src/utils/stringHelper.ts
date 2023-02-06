export function escapeString(t: string): string {
  const localText = t
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
    .split('"')
    .join("&quot;")
    .split("'")
    .join("&#039;");
  return localText;
}

export function decodeString(t: string): string {
  const localText = t
    .split("&amp;")
    .join("&")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&quot;")
    .join('"')
    .split("&#039;")
    .join("'");
  return localText;
}
