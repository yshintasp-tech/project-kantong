/**
 * Kantong Google Apps Script API
 * Deploy: Web app -> Execute as Me -> Who has access: Anyone
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1zdphsUM4XWvzsugzlR42M7y3JC8Dc9jNbbXYRyG-LFM/edit
 * Tidak membutuhkan API key atau Script Property.
 */
const CONFIG = {
  spreadsheetId: '1zdphsUM4XWvzsugzlR42M7y3JC8Dc9jNbbXYRyG-LFM',
  defaultOwnerEmail: 'yashintasyach@gmail.com',
  sheets: {
    income: 'pemasukan',
    expense: 'pengeluaran',
    saving: 'tabungan',
    target: 'target',
    users: 'user'
  },
  expenseCategories: ['food', 'transport', 'entertainment', 'shopping', 'others']
};

function doGet(e) {
  try {
    const action = (e.parameter.action || 'all').toLowerCase();
    const ownerEmail = e.parameter.ownerEmail || '';
    if (action === 'finance') return json({ records: readFinance(ownerEmail) });
    if (action === 'targets') return json({ targets: readTargets(ownerEmail) });
    if (action === 'users') return json({ users: readUsers() });
    return json({ records: readFinance(), targets: readTargets() });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = String(body.action || '').toLowerCase();
    if (action === 'create_user' || (action === 'create' && body.type === 'user')) return json(mutateUser(body));
    if (action === 'create' || action === 'update') return json(body.type === 'target' ? mutateTarget(body, action) : mutateRecord(body, action));
    if (action === 'delete') return json(body.type === 'target' ? deleteTarget(body) : deleteRecord(body));
    if (action === 'pin') return json(pinTarget(body));
    return json({ error: 'Action harus create, update, delete, pin, atau create_user.' }, 400);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

function readFinance(ownerEmail) {
  const records = [];
  Object.keys({ income: 1, expense: 1, saving: 1 }).forEach(function(type) {
    const sheet = getSheet(CONFIG.sheets[type]);
    if (!sheet) return;
    const tableData = table(sheet);
    tableData.rows.forEach(function(row) {
      const date = value(row, tableData.headers, 'date');
      const amount = Number(value(row, tableData.headers, 'nominal')) || 0;
      const rowOwner = value(row, tableData.headers, 'user') || value(row, tableData.headers, 'owneremail');
      if (!value(row, tableData.headers, 'id') || !date || amount <= 0 || (ownerEmail && String(rowOwner).toLowerCase() !== ownerEmail.toLowerCase())) return;
      records.push({
        id: value(row, tableData.headers, 'id'),
        name: value(row, tableData.headers, 'name') || 'Tanpa nama',
        date: formatDate(date),
        amount: amount,
        information: value(row, tableData.headers, 'information'),
        photoUrl: value(row, tableData.headers, 'url_foto'),
        type: type,
        target: value(row, tableData.headers, 'target'),
        category: normalizeCategory(value(row, tableData.headers, 'category')),
        ownerEmail: rowOwner
      });
    });
  });
  return records;
}

function readTargets(ownerEmail) {
  const sheet = getSheet(CONFIG.sheets.target);
  if (!sheet) return [];
  const tableData = table(sheet);
  return tableData.rows.filter(function(row) { const rowOwner = value(row, tableData.headers, 'user') || value(row, tableData.headers, 'owneremail'); return value(row, tableData.headers, 'id') && (!ownerEmail || String(rowOwner).toLowerCase() === ownerEmail.toLowerCase()); }).map(function(row) {
    return {
      id: value(row, tableData.headers, 'id'),
      name: value(row, tableData.headers, 'name') || 'Tanpa nama',
      targetDate: formatDate(value(row, tableData.headers, 'date')),
      targetAmount: Number(value(row, tableData.headers, 'nominal')) || 0,
      information: value(row, tableData.headers, 'information'),
      photoUrl: value(row, tableData.headers, 'url_foto'),
      pinned: String(value(row, tableData.headers, 'pinned')).toLowerCase() === 'true'
    };
  });
}

function readUsers() {
  const sheet = getSheet(CONFIG.sheets.users);
  if (!sheet) return [];
  const tableData = table(sheet);
  return tableData.rows.filter(function(row) { return value(row, tableData.headers, 'email') || value(row, tableData.headers, 'user'); }).map(function(row) {
    const roleVal = value(row, tableData.headers, 'role');
    const canEditVal = value(row, tableData.headers, 'canedit');
    const canEdit = canEditVal ? String(canEditVal).toLowerCase() === 'true' : true;
    return {
      id: value(row, tableData.headers, 'id') || value(row, tableData.headers, 'email'),
      email: value(row, tableData.headers, 'email') || value(row, tableData.headers, 'user'),
      passwordHash: value(row, tableData.headers, 'password') || value(row, tableData.headers, 'passwordhash'),
      nickname: value(row, tableData.headers, 'name') || value(row, tableData.headers, 'nickname'),
      canEdit: canEdit,
      role: roleVal || 'user'
    };
  });
}

function mutateUser(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const nickname = String(body.name || body.nickname || '').trim();
  const password = String(body.password || body.passwordHash || body.passwordhash || '').trim();
  const passwordHash = String(body.passwordHash || body.passwordhash || body.password || '').trim();
  const canEdit = body.canEdit !== false;
  const role = String(body.role || 'user').trim();

  if (!email || !nickname || !password) throw new Error('Email, nama, dan password wajib diisi.');

  let sheet = getSheet(CONFIG.sheets.users);
  if (!sheet) {
    try {
      sheet = getSpreadsheet().insertSheet(CONFIG.sheets.users);
    } catch (e) {
      throw new Error('Sheet user tidak ditemukan di spreadsheet.');
    }
  }

  let tableData = table(sheet);
  if (!tableData.headers || tableData.headers.length === 0) {
    sheet.appendRow(['Email', 'Password', 'Name', 'Role']);
    tableData = table(sheet);
  }

  const id = body.id || makeId('USR');
  const record = {
    id: id,
    email: email,
    password: password,
    passwordhash: passwordHash,
    nickname: nickname,
    name: nickname,
    canedit: canEdit ? 'TRUE' : 'FALSE',
    role: role || 'user'
  };

  const row = rowForHeaders(tableData.headers, record);

  const existingIndex = tableData.rows.findIndex(function(r) {
    return String(value(r, tableData.headers, 'email') || value(r, tableData.headers, 'user')).toLowerCase() === email;
  });

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, tableData.headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { user: { id: id, email: email, nickname: nickname, canEdit: canEdit, role: record.role } };
}

/**
 * Jalankan manual sekali dari editor Apps Script untuk mengaitkan data lama
 * yang kolom User-nya masih kosong ke satu akun tertentu.
 * Contoh: claimBlankRowsForUser('yashintasyach@gmail.com');
 */
function claimBlankRowsForUser(email) {
  email = String(email || CONFIG.defaultOwnerEmail).trim().toLowerCase();
  if (!email) throw new Error('Email wajib diisi.');
  ['pemasukan', 'pengeluaran', 'tabungan', 'target'].forEach(function(sheetName) {
    const sheet = getSheet(sheetName);
    if (!sheet) return;
    const tableData = table(sheet);
    const userColumn = tableData.headers.indexOf('user') >= 0 ? tableData.headers.indexOf('user') : tableData.headers.indexOf('owneremail');
    if (userColumn < 0) throw new Error('Tambahkan kolom User pada sheet ' + sheetName + '.');
    tableData.rows.forEach(function(row, index) {
      if (!String(row[userColumn] || '').trim() && value(row, tableData.headers, 'id')) sheet.getRange(index + 2, userColumn + 1).setValue(email);
    });
  });
}

function mutateRecord(body, action) {
  const type = String(body.type || '').toLowerCase();
  if (!['income', 'expense', 'saving'].includes(type)) throw new Error('Type transaksi tidak valid.');
  if (!body.name || !body.date || Number(body.amount) <= 0) throw new Error('Nama, tanggal, dan nominal wajib diisi.');
  if (type === 'saving' && !body.target) throw new Error('Tabungan wajib memiliki target.');
  const sheet = getSheet(CONFIG.sheets[type]);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + CONFIG.sheets[type]);
  const tableData = table(sheet);
  const record = { id: body.id || makeId('ID'), name: body.name, date: body.date, amount: Number(body.amount), information: body.information || '', photoUrl: body.photoUrl || '-', target: body.target || '', ownerEmail: body.ownerEmail || '', category: normalizeCategory(body.category) };
  const row = rowForHeaders(tableData.headers, record);
  if (action === 'create') sheet.appendRow(row);
  else updateRow(sheet, tableData, body.id, row);
  return { record: { ...record, date: formatDate(record.date), type: type } };
}

function mutateTarget(body, action) {
  if (!body.name || !body.targetDate || Number(body.targetAmount) <= 0) throw new Error('Nama, batas waktu, dan nominal target wajib diisi.');
  const sheet = getSheet(CONFIG.sheets.target);
  if (!sheet) throw new Error('Sheet tidak ditemukan: target');
  const tableData = table(sheet);
  const record = { id: body.id || makeId('TG'), name: body.name, date: body.targetDate, nominal: Number(body.targetAmount), information: body.information || '', photoUrl: body.photoUrl || '-', target: body.ownerEmail || '', pinned: body.pinned === true ? 'TRUE' : 'FALSE' };
  const row = rowForHeaders(tableData.headers, record);
  if (action === 'create') sheet.appendRow(row);
  else updateRow(sheet, tableData, body.id, row);
  return { target: { id: record.id, name: record.name, targetDate: formatDate(record.date), targetAmount: record.nominal, information: record.information, photoUrl: record.photoUrl, pinned: record.pinned === 'TRUE' } };
}

function deleteRecord(body) {
  if (!body.id) throw new Error('ID wajib diisi.');
  const types = ['income', 'expense', 'saving'];
  for (let i = 0; i < types.length; i += 1) {
    const sheet = getSheet(CONFIG.sheets[types[i]]);
    if (!sheet) continue;
    const tableData = table(sheet);
    const index = findRow(tableData, body.id);
    if (index >= 0) { sheet.deleteRow(index + 2); return { ok: true, id: body.id }; }
  }
  throw new Error('Transaksi tidak ditemukan.');
}

function deleteTarget(body) {
  const sheet = getSheet(CONFIG.sheets.target);
  if (!sheet || !body.id) throw new Error('Target atau ID tidak ditemukan.');
  const tableData = table(sheet);
  const index = findRow(tableData, body.id);
  if (index < 0) throw new Error('Target tidak ditemukan.');
  sheet.deleteRow(index + 2);
  return { ok: true, id: body.id };
}

function pinTarget(body) {
  const sheet = getSheet(CONFIG.sheets.target);
  if (!sheet || !body.id) throw new Error('Target atau ID tidak ditemukan.');
  const tableData = table(sheet);
  const index = findRow(tableData, body.id);
  if (index < 0) throw new Error('Target tidak ditemukan.');
  const headers = tableData.headers;
  const pinnedColumn = headers.indexOf('pinned');
  if (pinnedColumn < 0) throw new Error('Kolom Pinned belum tersedia di sheet target.');
  sheet.getRange(index + 2, pinnedColumn + 1).setValue(body.pinned === true ? 'TRUE' : 'FALSE');
  return { ok: true, id: body.id, pinned: body.pinned === true };
}

function updateRow(sheet, tableData, id, record) {
  const index = findRow(tableData, id);
  if (index < 0) throw new Error('ID tidak ditemukan: ' + id);
  sheet.getRange(index + 2, 1, 1, tableData.headers.length).setValues([record]);
}

function rowForHeaders(headers, record) {
  return headers.map(function(header) {
    if (header === 'id') return record.id || '';
    if (header === 'name' || header === 'nama') return record.name || record.nickname || '';
    if (header === 'nickname' || header === 'namapanggilan') return record.nickname || record.name || '';
    if (header === 'password') return record.password || record.passwordhash || '';
    if (header === 'passwordhash') return record.passwordhash || record.password || '';
    if (header === 'role' || header === 'peran') return record.role || 'user';
    if (header === 'canedit') return record.canedit || 'TRUE';
    if (header === 'date' || header === 'tanggal') return record.date || '';
    if (header === 'nominal' || header === 'amount') return record.amount ?? record.nominal ?? '';
    if (header === 'information' || header === 'keterangan') return record.information || '';
    if (header === 'urlfoto') return record.photoUrl || '-';
    if (header === 'target') return record.target || '';
    if (header === 'owneremail') return record.ownerEmail || record.email || '';
    if (header === 'user') return record.email || record.ownerEmail || '';
    if (header === 'email') return record.email || '';
    if (header === 'category') return record.category || 'others';
    if (header === 'pinned') return record.pinned || 'FALSE';
    return '';
  });
}

function table(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values.shift() || []).map(function(header) { return String(header).toLowerCase().replace(/[^a-z0-9]/g, ''); });
  return { headers: headers, rows: values };
}

function value(row, headers, name) {
  const index = headers.indexOf(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return index < 0 ? '' : row[index];
}

function findRow(tableData, id) {
  const index = tableData.headers.indexOf('id');
  return tableData.rows.findIndex(function(row) { return String(row[index]) === String(id); });
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  const target = String(name || '').toLowerCase().trim();
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const sName = allSheets[i].getName().toLowerCase().trim();
    if (sName === target) return allSheets[i];
    if (target === 'users' && (sName === 'user' || sName === 'pengguna')) return allSheets[i];
    if (target === 'user' && sName === 'users') return allSheets[i];
  }
  return null;
}
function getSpreadsheet() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || CONFIG.spreadsheetId); }
function normalizeCategory(value) {
  const category = String(value || '').toLowerCase().trim();
  return category === 'entertaiment' ? 'entertainment' : CONFIG.expenseCategories.includes(category) ? category : 'others';
}
function formatDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? match[3] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[1]).slice(-2) : String(value);
}
function makeId(prefix) { return prefix + new Date().getTime().toString().slice(-6); }
function json(data, status) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
