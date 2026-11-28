// Local integration smoke. Each run owns a fresh database, role, and private storage directory.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const server = createRequire(join(__dirname, '../../server/package.json'));
server('reflect-metadata');
const { Client, Pool } = server('pg');
const { Workbook } = server('exceljs');
const { io } = server('socket.io-client');
const { NestFactory } = server('@nestjs/core');
const { runMigrations } = server('./dist/platform/migrator');
const { hashPassword } = server('./dist/modules/auth/password');

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const source = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function poll(read, ready, label) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const result = await read();
    assert.notEqual(result.status, 'failed', label + ' failed');
    if (ready(result)) return result;
    await delay(250);
  }
  throw new Error(label + ' timed out');
}

function makeApi(origin) {
  return async function request(path, { token, json, form, method, status = 200, binary = false } = {}) {
    const response = await fetch(origin + '/api/v1' + path, {
      method: method ?? (json || form ? 'POST' : 'GET'),
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(8_000),
    });
    assert.equal(response.status, status, (method ?? (json || form ? 'POST' : 'GET')) + ' ' + path);
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
}

async function seed(pool) {
  const company = randomUUID(), otherCompany = randomUUID();
  const warehouse = randomUUID(), otherWarehouse = randomUUID(), unassigned = randomUUID();
  const supplier = randomUUID(), customer = randomUUID(), product = randomUUID();
  const password = randomBytes(20).toString('hex');
  await pool.query('INSERT INTO companies(id,name) VALUES($1,$2),($3,$4)', [company, 'Synthetic pilot', otherCompany, 'Other company']);
  for (const [id, tenant, code] of [[warehouse, company, 'PILOT'], [unassigned, company, 'UNASSIGNED'], [otherWarehouse, otherCompany, 'OTHER']]) {
    await pool.query('INSERT INTO warehouses(id,tenant_id,name,code) VALUES($1,$2,$3,$3)', [id, tenant, code]);
  }
  for (const [phone, role, tenant, scope] of [
    ['0001', 'owner', company, warehouse], ['0002', 'trader', company, warehouse],
    ['0003', 'worker', company, warehouse], ['0004', 'owner', otherCompany, otherWarehouse],
  ]) {
    const id = randomUUID();
    await pool.query('INSERT INTO users(id,tenant_id,name,phone,role,password_hash) VALUES($1,$2,$3,$4,$3,$5)',
      [id, tenant, role, phone, hashPassword(password)]);
    await pool.query('INSERT INTO memberships(tenant_id,user_id,warehouse_id) VALUES($1,$2,$3)', [tenant, id, scope]);
  }
  await pool.query("INSERT INTO parties(id,tenant_id,name,type) VALUES($1,$2,'Sample supplier','supplier'),($3,$2,'Sample customer','customer')", [supplier, company, customer]);
  await pool.query("INSERT INTO products(id,tenant_id,name_en,name_ar,name_cn) VALUES($1,$2,'Synthetic item','منتج تجريبي','测试商品')", [product, company]);
  return { warehouse, unassigned, supplier, customer, product, password };
}

async function runWorkflows(origin, fixture, clients) {
  const api = makeApi(origin);
  const { warehouse, unassigned, supplier, customer, product, password } = fixture;
  const login = async phone => (await api('/auth/login', { json: { phone, password }, status: 201 })).accessToken;
  const [owner, trader, worker, other] = await Promise.all(['0001', '0002', '0003', '0004'].map(login));
  const scope = '?warehouseId=' + warehouse;

  assert.equal((await api('/health/ready')).database, 'up');
  await api('/settings/receiving-tolerances', { token: owner });
  await api('/settings/receiving-tolerances', { token: trader, status: 403 });
  await api('/imports?warehouseId=' + unassigned, { token: trader, status: 403 });
  await api('/exports' + scope, { token: worker, status: 403 });
  await api('/imports' + scope, { token: worker, status: 403 });

  async function importInvoice(kind, token, bytes = source, type = 'image/png', filename = 'synthetic.png') {
    const form = new FormData();
    form.set('uploadId', randomUUID());
    form.set('purpose', kind === 'orders' ? 'invoice_source' : 'expense_invoice');
    form.set('file', new Blob([bytes], { type }), filename);
    const file = await api('/files' + scope, { token, form, status: 201 });
    const filepath = '/files/' + file.id + '/content';
    assert.deepEqual(await api(filepath, { token, binary: true }), bytes);
    await api(filepath, { status: 401 });
    await api(filepath, { token: worker, status: 403 });
    await api(filepath, { token: other, status: 404 });
    const job = await api('/' + kind + '/extract', { token, json: { warehouseId: warehouse, fileId: file.id }, status: 201 });
    const path = '/imports/' + job.id;
    await api(path, { token: other, status: 404 });
    const draft = await poll(() => api(path, { token }), value => value.status === 'draft', kind + ' extraction');
    assert.equal(draft.provider, type === xlsxType ? 'xlsx' : 'sample');
    if (type !== xlsxType) {
      assert.ok(draft.unreviewedFields.length);
      await api(path + '/commit', { token, method: 'POST', status: 409 });
    }
    return { path, draft, file };
  }

  const purchase = await importInvoice('orders', trader);
  await api(purchase.path, { token: trader, method: 'PATCH', json: {
    lines: purchase.draft.draft.lines.map(() => ({ productId: product })),
    review: { supplierId: supplier, customerId: customer, reviewedFields: purchase.draft.unreviewedFields },
  } });
  const commit = () => api(purchase.path + '/commit', { token: trader, method: 'POST', status: 201 });
  const { orderId } = await commit();
  assert.equal((await commit()).orderId, orderId);
  const orderPath = '/orders/' + orderId;
  const order = await api(orderPath, { token: trader });
  assert.equal(order.status, 'draft');
  assert.equal(order.totalAmount, 2880);
  await api(orderPath + '/confirm', { token: trader, method: 'POST' });

  const originalBook = new Workbook();
  const originalSheet = originalBook.addWorksheet('Invoice');
  originalSheet.addRows([
    ['供应商', 'Sample supplier'], ['币种', 'USD'],
    ['产品', '箱数', '每箱', '单价', '金额'],
    ['测试商品', 2, 4, 1.5, 12],
  ]);
  const original = Buffer.from(await originalBook.xlsx.writeBuffer());
  const spreadsheet = await importInvoice('orders', trader, original, xlsxType, 'synthetic.xlsx');
  assert.equal(spreadsheet.draft.draft.header.supplierName.value, 'Sample supplier');
  assert.equal(spreadsheet.draft.draft.lines[0].amount.value, 12);

  const expense = await importInvoice('expenses', owner);
  const categories = await api('/expense-categories', { token: owner });
  const categoryId = categories.categories.find(category => category.active).id;
  await api(expense.path, { token: owner, method: 'PATCH', json: {
    review: { categoryId, customerId: customer, reviewedFields: expense.draft.unreviewedFields },
  } });
  const { expenseId } = await api(expense.path + '/commit', { token: owner, method: 'POST', status: 201 });
  assert.equal((await api('/expenses/' + expenseId, { token: trader })).invoiceFileId, expense.file.id);

  async function workbook(kind, filters) {
    const job = await api('/exports', { token: trader, json: { warehouseId: warehouse, kind, filters }, status: 201 });
    const path = '/exports/' + job.id;
    await poll(() => api(path, { token: trader }), value => value.status === 'completed', kind + ' workbook');
    await api(path + '/file', { token: worker, status: 403 });
    await api(path + '/file', { token: other, status: 404 });
    const book = new Workbook();
    await book.xlsx.load(await api(path + '/file', { token: trader, binary: true }));
    return book.getWorksheet(1);
  }

  const orderSheet = await workbook('purchase_order', { orderId });
  for (const name of ['Synthetic item', 'منتج تجريبي', '测试商品']) {
    assert.ok(orderSheet.getRow(2).values.includes(name));
  }
  const expenseSheet = await workbook('expenses', { customerId: customer });
  assert.equal(expenseSheet.getCell('D2').value, 100.5);
  assert.equal(expenseSheet.rowCount, 3); // Header, one filtered expense, totals.

  const socket = io(origin, { auth: { token: trader }, transports: ['websocket'], autoConnect: false, reconnection: false });
  clients.push(socket);
  async function connect() {
    const connected = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 5_000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
    });
    socket.connect();
    await connected;
    assert.equal((await socket.timeout(4000).emitWithAck('subscribe', { warehouseId: unassigned })).ok, false);
    assert.deepEqual(await socket.timeout(4000).emitWithAck('subscribe', { warehouseId: warehouse }), { ok: true, warehouseId: warehouse });
  }
  await connect();
  const receive = (cartons) => api('/receipts/confirm', { token: worker, json: {
    clientOperationId: randomUUID(), warehouseId: warehouse, orderId,
    lines: [{ orderLineId: order.lines[0].id, cartons, condition: 'ok' }],
  } });
  const event = new Promise(resolve => socket.once('receipt.confirmed', resolve));
  await receive(2);
  assert.ok(await Promise.race([event, delay(5000).then(() => null)]), 'live receipt event');
  socket.disconnect();
  await receive(2);
  await connect();
  assert.equal((await api(orderPath, { token: trader })).status, 'partly_received');
  const balances = await api('/stock' + scope, { token: trader });
  assert.equal(balances.balances.reduce((total, row) => total + Number(row.cartons), 0), 4);
}

async function main() {
  const profile = process.argv[2] ?? 'international';
  assert.ok(['international', 'cn-mainland'].includes(profile), 'Choose international or cn-mainland');
  const admin = new URL(process.env.TEST_ADMIN_DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(admin.hostname), 'This smoke runner requires local PostgreSQL');
  assert.equal(admin.search, '', 'Use a local PostgreSQL URL without connection overrides');
  const name = 'jahez_pilot_test_' + randomBytes(6).toString('hex');
  const role = name + '_app', secret = randomBytes(24).toString('hex');
  const control = new Client({ connectionString: admin.href });
  const storage = await mkdtemp(join(tmpdir(), 'jahez-pilot-'));
  const clients = [];
  let pool, api, worker, createdRole, createdDatabase;
  try {
    await control.connect();
    await control.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOBYPASSRLS`);
    createdRole = true;
    await control.query(`CREATE DATABASE "${name}"`);
    createdDatabase = true;
    const dbUrl = new URL(admin); dbUrl.pathname = '/' + name;
    pool = new Pool({ connectionString: dbUrl.href });
    await runMigrations(pool, role);
    await pool.query(`GRANT USAGE ON SCHEMA public TO "${role}";
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}";
      GRANT INSERT ON auth_sessions, audit_events, orders, order_lines, receipts, receipt_lines,
        findings, stock_movements, sync_changes, files, expenses, export_jobs, invoice_imports TO "${role}";
      GRANT INSERT, UPDATE ON client_operations, document_counters TO "${role}";
      GRANT UPDATE ON users, parties, orders, order_lines, auth_sessions TO "${role}";
      GRANT DELETE ON order_lines TO "${role}";
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    const fixture = await seed(pool);
    dbUrl.username = role; dbUrl.password = secret;
    Object.assign(process.env, {
      DATABASE_URL: dbUrl.href, MIGRATION_DATABASE_URL: '',
      JWT_SECRET: randomBytes(32).toString('hex'), PORT: '3000',
      DEPLOYMENT_PROFILE: profile, INVOICE_AI_PROVIDER: 'sample',
      STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: storage,
    });
    const { AppModule } = server('./dist/app.module');
    const { RealtimeService } = server('./dist/modules/realtime/realtime.service');
    const { JobsService } = server('./dist/modules/jobs/jobs.service');
    api = await NestFactory.create(AppModule, { logger: ["error"], abortOnError: false });
    api.setGlobalPrefix('api/v1');
    api.get(RealtimeService).attach(api.getHttpServer());
    await api.listen(0, '127.0.0.1');
    worker = await NestFactory.createApplicationContext(AppModule, { logger: ["error"], abortOnError: false });
    await worker.get(JobsService).startConsuming();
    await runWorkflows(await api.getUrl(), fixture, clients);
    console.log(`PASS ${profile}: private files, role and warehouse boundaries, purchase and expense imports, XLSX export, receipt live event, and REST catch-up after reconnect`);
  } finally {
    clients.forEach(client => client.close());
    try {
      await Promise.all([worker?.close(), api?.close(), pool?.end()]);
    } finally {
      try {
        if (createdDatabase) await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        if (createdRole) await control.query(`DROP ROLE "${role}"`);
      } finally {
        await control.end();
        await rm(storage, { recursive: true, force: true });
      }
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
