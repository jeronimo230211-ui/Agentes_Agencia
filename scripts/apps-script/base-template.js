/**
 * Google Apps Script — Base Template
 * Agency: AI Automation & Integrated Solutions
 *
 * Deploy as: Web App → Execute as Me → Anyone can access
 *
 * Endpoints:
 *   GET /      → returns all records from MAIN_SHEET as JSON
 *   POST /     → saves a new record (default)
 *   POST / {tipo: 'updateStatus'} → updates a record's status
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const MAIN_SHEET     = 'SHEET_NAME';

function doGet(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MAIN_SHEET);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows    = data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const sheet  = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MAIN_SHEET);

    if (body.tipo === 'updateStatus') {
      return updateStatus(sheet, body);
    }

    return saveRecord(sheet, body);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function saveRecord(sheet, body) {
  const timestamp = new Date();
  const id = 'REC-' + timestamp.getTime();

  // TODO: map body fields to columns
  sheet.appendRow([id, Utilities.formatDate(timestamp, 'America/Bogota', 'dd/MM/yyyy'), '']);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateStatus(sheet, body) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      sheet.getRange(i + 1, /* STATUS_COLUMN */ 10).setValue(body.status);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: 'Record not found' }))
    .setMimeType(ContentService.MimeType.JSON);
}
