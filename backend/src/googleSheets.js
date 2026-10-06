import { GoogleAuth } from "google-auth-library";

// --- Google Sheets via REST ------------------------------------------------
// Authenticates with the service-account JSON stored whole in the
// GOOGLE_CREDENTIALS_JSON env var (Heroku config var / backend/.env). Share
// each spreadsheet with that account's client_email (Viewer to read, Editor
// to write), or Google returns 403.

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

let client = null;

function credentials() {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON is not set");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_CREDENTIALS_JSON is not valid JSON");
  }
}

async function sheetsRequest(method, path, body) {
  client ??= await new GoogleAuth({
    credentials: credentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }).getClient();
  const res = await client.request({ url: `${SHEETS_API}/${path}`, method, data: body, validateStatus: () => true });
  if (res.status >= 400) {
    const msg = res.data?.error?.message || res.statusText;
    throw new Error(`Sheets ${method} ${path} -> ${res.status} ${msg}`.trim());
  }
  return res.data;
}

/** The service account's email — share spreadsheets with this address. */
export function sheetsServiceEmail() {
  return credentials().client_email;
}

/** Spreadsheet title + its tab names. */
export async function getSpreadsheetInfo(spreadsheetId) {
  const data = await sheetsRequest("GET", `${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`);
  return { title: data.properties.title, tabs: data.sheets.map((s) => s.properties.title) };
}

/**
 * Reads a range (e.g. "Sheet1" or "Sheet1!A1:F200") and returns it as
 * objects keyed by the first row's headers.
 */
export async function readSheetRows(spreadsheetId, range) {
  const data = await sheetsRequest(
    "GET",
    `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  );
  const [headers = [], ...rows] = data.values || [];
  return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

/** Appends rows (arrays of cell values) to the end of a range. */
export async function appendSheetRows(spreadsheetId, range, rows) {
  return sheetsRequest(
    "POST",
    `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { values: rows },
  );
}
