// Google Drive storage via REST + refresh-token flow. Returns null whenever the
// credentials are not configured yet, so callers can fall back to local storage.
export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

export async function getAccessToken(): Promise<string | null> {
  if (!driveConfigured()) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("Drive token refresh failed", await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (error) {
    console.error("Drive token refresh error", error);
    return null;
  }
}

/** Uploads a file to Drive (into GOOGLE_DRIVE_FOLDER_ID when set). Returns null if unavailable. */
export async function uploadToDrive(
  name: string,
  mime: string,
  base64: string,
): Promise<{ id: string; link: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const boundary = "visa-app-" + Math.random().toString(36).slice(2);
    const meta: Record<string, unknown> = { name };
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) meta.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];

    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) +
      `\r\n--${boundary}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
      base64 +
      `\r\n--${boundary}--`;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) {
      console.error("Drive upload failed", await res.text());
      return null;
    }
    const json = (await res.json()) as { id: string; webViewLink?: string };
    return { id: json.id, link: json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view` };
  } catch (error) {
    console.error("Drive upload error", error);
    return null;
  }
}

/** Downloads a file's bytes from Drive as base64. Returns null if unavailable. */
export async function downloadFromDrive(driveFileId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.error("Drive download failed", await res.text());
      return null;
    }
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch (error) {
    console.error("Drive download error", error);
    return null;
  }
}
