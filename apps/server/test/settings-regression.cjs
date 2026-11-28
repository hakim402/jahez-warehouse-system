// Uses only a newly created database and role. Never migrates or seeds the configured application database.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { Client, Pool } = require('pg');
const { runMigrations } = require('../dist/platform/migrator');
const { DatabaseService } = require('../dist/platform/database.service');
const { SettingsService } = require('../dist/modules/settings/settings.service');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { SessionAuthService } = require('../dist/modules/tenancy/session-auth.service');
const { TenancyService } = require('../dist/modules/tenancy/tenancy.service');
const { InventoryService } = require('../dist/modules/inventory/inventory.service');
const { ReceivingService } = require('../dist/modules/receiving/receiving.service');
const { hashPassword } = require('../dist/modules/auth/password');
async function rejects(action, status, code) {
  await assert.rejects(async () => action(), error => error.getStatus?.() === status && (!code || error.getResponse().code === code));
}
(async () => {
  if (!process.env.TEST_ADMIN_DATABASE_URL) throw new Error('Set TEST_ADMIN_DATABASE_URL to a local PostgreSQL administrator connection');
  const name = 'jahez_settings_test_' + randomBytes(6).toString('hex');
  const role = name + '_app', secret = randomBytes(24).toString('hex');
  const adminUrl = new URL(process.env.TEST_ADMIN_DATABASE_URL);
  const control = new Client({ connectionString: adminUrl.href });
  await control.connect();
  let pool, db;
  try {
    await control.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOBYPASSRLS`);
    await control.query(`CREATE DATABASE "${name}"`);
    const dbUrl = new URL(adminUrl); dbUrl.pathname = '/' + name;
    pool = new Pool({ connectionString: dbUrl.href });
    assert.ok((await runMigrations(pool, role)).includes('0012_user_access_settings'));
    assert.deepEqual(await runMigrations(pool, role), []);
    await pool.query(`GRANT USAGE ON SCHEMA public TO "${role}";
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}";
      GRANT INSERT, UPDATE ON companies, users, warehouses, auth_sessions TO "${role}";
      GRANT INSERT, DELETE ON memberships TO "${role}";
      GRANT INSERT ON audit_events, receipts, receipt_lines, findings, stock_movements, sync_changes TO "${role}";
      GRANT INSERT, UPDATE ON client_operations, document_counters TO "${role}";
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
    const tenant = randomUUID(), otherTenant = randomUUID(), ownerId = randomUUID(), warehouse = randomUUID(), otherWarehouse = randomUUID();
    await pool.query('INSERT INTO companies(id,name) VALUES($1,$2),($3,$4)', [tenant, 'Synthetic company', otherTenant, 'Other synthetic company']);
    await pool.query('INSERT INTO warehouses(id,tenant_id,name,code) VALUES($1,$2,$3,$4),($5,$6,$7,$8)', [warehouse,tenant,'Sample warehouse','WH1',otherWarehouse,otherTenant,'Other warehouse','WH2']);
    const pass = 'synthetic-password-123';
    await pool.query("INSERT INTO users(id,tenant_id,name,phone,role,password_hash) VALUES($1,$2,'Initial owner','0001','owner',$3)", [ownerId,tenant,hashPassword(pass)]);
    await pool.query('INSERT INTO memberships(tenant_id,user_id,warehouse_id) VALUES($1,$2,$3)',[tenant,ownerId,warehouse]);
    const appUrl = new URL(dbUrl); appUrl.username = role; appUrl.password = secret;
    const config = { databaseUrl: appUrl.href, databasePoolMax: 10, databaseTimeoutMs: 10000, jwtSecret: randomBytes(32).toString('hex') };
    db = new DatabaseService(config);
    const settings = new SettingsService(db), auth = new AuthService(db,config), sessions = new SessionAuthService(config,db);
    const initialTokens = await auth.login({phone:'0001',password:pass,tenantId:tenant});
    const owner = (await sessions.authenticate(initialTokens.accessToken)).user;
    for (const role of ['trader','worker']) {
      const actor = {...owner,role};
      for (const call of [() => settings.listUsers(actor,{}), () => settings.getUser(actor,ownerId), () => settings.listWarehouses(actor), () => settings.getTolerances(actor), () => settings.updateTolerances(actor,{cbmTolerancePercent:3,weightTolerancePercent:5,expectedVersion:1}), () => settings.createUser(actor,{name:'Denied',phone:role,role,initialPassword:pass,warehouseIds:[]}), () => settings.updateUser(actor,ownerId,{expectedVersion:1,name:'Denied'}), () => settings.resetPassword(actor,ownerId,{expectedVersion:1,newPassword:pass})]) await rejects(call,403);
    }
    assert.equal((await settings.listWarehouses(owner)).warehouses.length,1);
    await rejects(() => settings.createUser(owner,{name:'Bad assignment',phone:'0003',role:'worker',initialPassword:pass,warehouseIds:[otherWarehouse]}),400,'INVALID_WAREHOUSE');
    for (const initialPassword of ['short', 'x'.repeat(129)]) await rejects(() => settings.createUser(owner,{name:'Bad',phone:'0003',role:'worker',initialPassword,warehouseIds:[]}),400);
    let worker = (await settings.createUser(owner,{name:'Sample worker',phone:'0003',role:'worker',initialPassword:pass,warehouseIds:[warehouse]})).user;
    assert.deepEqual(worker.warehouseIds,[warehouse]);
    assert.equal(worker.active,true);
    await rejects(() => settings.createUser(owner,{name:'Duplicate',phone:'0003',role:'worker',initialPassword:pass,warehouseIds:[]}),409,'PHONE_CONFLICT');
    await rejects(() => settings.updateUser({...owner,tenantId:otherTenant},worker.id,{expectedVersion:1,name:'Leak'}),403);
    const otherOwnerId=randomUUID();
    await pool.query("INSERT INTO users(id,tenant_id,name,phone,role,password_hash) VALUES($1,$2,'Other owner','0001','owner',$3)",[otherOwnerId,otherTenant,hashPassword(pass)]);
    const otherActor = {...owner,id:otherOwnerId,tenantId:otherTenant};
    await rejects(() => settings.getUser(otherActor,worker.id),404);
    await rejects(() => settings.updateUser(otherActor,worker.id,{expectedVersion:1,name:'Leak'}),404);
    assert.equal((await settings.listUsers(otherActor,{})).users.length,1);
    for (let attempt=0; attempt<3; attempt++) {
      const [changed] = await Promise.all([settings.updateUser(owner,worker.id,{expectedVersion:worker.version,name:'Concurrent worker'}),auth.login({phone:'0003',password:pass,tenantId:tenant})]);
      worker=changed.user;
    }
    const workerTokens = await auth.login({phone:'0003',password:pass,tenantId:tenant});
    const workerSession = await sessions.authenticate(workerTokens.accessToken);
    worker = (await settings.updateUser(owner,worker.id,{name:'Updated worker',expectedVersion:worker.version})).user;
    await sessions.authenticate(workerTokens.accessToken); // Identity-only changes keep sessions.
    await rejects(() => settings.updateUser(owner,worker.id,{name:'Stale',expectedVersion:1}),409,'STALE_VERSION');
    worker = (await settings.updateUser(owner,worker.id,{warehouseIds:[],expectedVersion:worker.version})).user;
    await rejects(() => sessions.authenticate(workerTokens.accessToken),401);
    await rejects(() => sessions.revalidate(workerSession,warehouse),401);
    await rejects(() => auth.refresh(workerTokens.refreshToken),401);
    const next = await auth.login({phone:'0003',password:pass,tenantId:tenant});
    worker = (await settings.resetPassword(owner,worker.id,{newPassword:'replacement-password-123',expectedVersion:worker.version})).user;
    await rejects(() => sessions.authenticate(next.accessToken),401);
    await rejects(() => auth.login({phone:'0003',password:pass,tenantId:tenant}),401);
    const resetTokens = await auth.login({phone:'0003',password:'replacement-password-123',tenantId:tenant});
    worker = (await settings.updateUser(owner,worker.id,{active:false,expectedVersion:worker.version})).user;
    await rejects(() => auth.login({phone:'0003',password:'replacement-password-123',tenantId:tenant}),401);
    await rejects(() => auth.refresh(resetTokens.refreshToken),401);
    await rejects(() => sessions.authenticate(resetTokens.accessToken),401);
    worker = (await settings.updateUser(owner,worker.id,{active:true,expectedVersion:worker.version})).user;
    await rejects(() => sessions.authenticate(resetTokens.accessToken),401);
    await auth.login({phone:'0003',password:'replacement-password-123',tenantId:tenant});
    // Exercise the actual Nest controllers, authentication and owner guard over HTTP.
    const { Module } = require('@nestjs/common'), { NestFactory } = require('@nestjs/core');
    const { SettingsController, UsersController } = require('../dist/modules/settings/settings.controller');
    const { AuthController } = require('../dist/modules/auth/auth.controller');
    const { AuthGuard } = require('../dist/modules/tenancy/auth.guard');
    const { OwnerGuard } = require('../dist/modules/settings/owner.guard');
    const { SERVER_CONFIG } = require('../dist/platform/server-config');
    class VerificationModule {}
    Module({ controllers:[SettingsController,UsersController,AuthController], providers:[SettingsService,AuthService,SessionAuthService,AuthGuard,OwnerGuard,
      {provide:SERVER_CONFIG,useValue:config}, {provide:DatabaseService,useValue:{query:db.query.bind(db),withTenant:db.withTenant.bind(db)}}] })(VerificationModule);
    const app=await NestFactory.create(VerificationModule,{logger:false});
    app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
    try {
      const origin=await app.getUrl();
      const request=async (path,token,method='GET',body) => {
        const response=await fetch(origin+'/api/v1'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
        return {status:response.status,body:await response.json()};
      };
      assert.equal((await request('/users')).status,401);
      for(const path of ['/users?limit=50','/users/'+worker.id,'/settings/warehouses','/settings/receiving-tolerances']) assert.equal((await request(path,initialTokens.accessToken)).status,200);
      const created=await request('/users',initialTokens.accessToken,'POST',{name:'HTTP trader',phone:'http-trader',role:'trader',initialPassword:pass,warehouseIds:[warehouse]});
      assert.equal(created.status,201);assert.equal(created.body.user.role,'trader');
      assert.ok(!JSON.stringify(created.body).includes(pass));
      const login=await request('/auth/login',null,'POST',{phone:'http-trader',password:pass,tenantId:tenant});
      assert.equal(login.status,201);
      for(const path of ['/users','/settings/warehouses','/settings/receiving-tolerances']) assert.equal((await request(path,login.body.accessToken)).status,403);
      assert.equal((await request('/users',login.body.accessToken,'POST',{})).status,403);
      const updated=await request('/users/'+created.body.user.id,initialTokens.accessToken,'PATCH',{expectedVersion:1,name:'HTTP updated'});
      assert.equal(updated.status,200);assert.equal(updated.body.user.version,2);
      const stale=await request('/users/'+created.body.user.id,initialTokens.accessToken,'PATCH',{expectedVersion:1,name:'Stale'});
      assert.equal(stale.status,409);assert.equal(stale.body.code,'STALE_VERSION');
      assert.equal((await request('/users/'+created.body.user.id+'/password-reset',initialTokens.accessToken,'POST',{expectedVersion:2,newPassword:'http-replacement-password'})).status,201);
      assert.equal((await request('/users',login.body.accessToken)).status,401);
    } finally { await app.close(); }

    await rejects(() => settings.updateUser(owner,owner.id,{active:false,expectedVersion:1}),400,'SELF_DISABLE');
    await rejects(() => settings.updateUser(owner,owner.id,{role:'trader',expectedVersion:1}),409,'LAST_OWNER');
    const second = (await settings.createUser(owner,{name:'Second owner',phone:'0004',role:'owner',initialPassword:pass,warehouseIds:[]})).user;
    // Both requests initially see two owners. Only one may demote an owner.
    const secondActor={...owner,id:second.id};
    const concurrent=await Promise.allSettled([
      settings.updateUser(owner,owner.id,{role:'trader',expectedVersion:1}),
      settings.updateUser(secondActor,second.id,{role:'trader',expectedVersion:second.version}),
    ]);
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(concurrent.find(x=>x.status==='rejected').reason.getResponse().code,'LAST_OWNER');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM users WHERE tenant_id=$1 AND role='owner' AND active",[tenant])).rows[0].n,1);
    const survivor=(await pool.query("SELECT id FROM users WHERE tenant_id=$1 AND role='owner' AND active",[tenant])).rows[0].id;
    const actor={...owner,id:survivor};
    // Stable cursor pages, literal search and status/role filters.
    for(let index=0;index<53;index++) await pool.query("INSERT INTO users(tenant_id,name,phone,role) VALUES($1,$2,$3,'worker')",[tenant,'Page worker '+index,'page-'+index]);
    const first=await settings.listUsers(actor,{limit:'50'}), secondPage=await settings.listUsers(actor,{limit:'50',cursor:first.nextCursor});
    assert.equal(first.users.length,50);assert.ok(first.nextCursor);assert.equal(secondPage.nextCursor,null);
    assert.equal(new Set([...first.users,...secondPage.users].map(x=>x.id)).size,(await pool.query('SELECT count(*)::int AS n FROM users WHERE tenant_id=$1',[tenant])).rows[0].n);
    assert.equal((await settings.listUsers(actor,{search:'Page worker',role:'worker',active:'true'})).users.length,50);
    assert.equal((await settings.listUsers(actor,{search:'%'})).users.length,0);
    await rejects(()=>settings.listUsers(actor,{limit:'201'}),400);
    let tolerance=await settings.getTolerances(actor);
    assert.equal(tolerance.cbmTolerancePercent,'3.00');assert.equal(tolerance.weightTolerancePercent,'5.00');
    for(const value of [-1,101,'0.001','NaN','Infinity','']) await rejects(()=>settings.updateTolerances(actor,{cbmTolerancePercent:value,weightTolerancePercent:5,expectedVersion:tolerance.version}),400);
    tolerance=await settings.updateTolerances(actor,{cbmTolerancePercent:'0',weightTolerancePercent:'100',expectedVersion:tolerance.version});
    assert.equal(tolerance.cbmTolerancePercent,'0.00');assert.equal(tolerance.weightTolerancePercent,'100.00');
    await rejects(()=>settings.updateTolerances(actor,{cbmTolerancePercent:3,weightTolerancePercent:5,expectedVersion:1}),409,'STALE_VERSION');
    tolerance=await settings.updateTolerances(actor,{cbmTolerancePercent:'3',weightTolerancePercent:'5',expectedVersion:tolerance.version});
    // Exercise real receipt comparison, preserving the first receipt's findings after a setting change.
    const supplier=randomUUID(),customer=randomUUID(),product=randomUUID();
    await pool.query("INSERT INTO parties(id,tenant_id,name,type) VALUES($1,$2,'Supplier','supplier'),($3,$2,'Customer','customer')",[supplier,tenant,customer]);
    await pool.query("INSERT INTO products(id,tenant_id,name_en) VALUES($1,$2,'Product')",[product,tenant]);
    await pool.query('INSERT INTO memberships(tenant_id,user_id,warehouse_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[tenant,survivor,warehouse]);
    const receiving=new ReceivingService(db,new TenancyService(db),new InventoryService(db),{publish(){}});
    async function receive(no) {
      const order=randomUUID(),line=randomUUID();
      await pool.query("INSERT INTO orders(id,tenant_id,warehouse_id,order_no,customer_id,supplier_id,status) VALUES($1,$2,$3,$4,$5,$6,'ready')",[order,tenant,warehouse,'SYNTH-'+no,customer,supplier]);
      await pool.query('INSERT INTO order_lines(id,tenant_id,order_id,product_id,cartons,qty_per_carton,qty,cbm,weight) VALUES($1,$2,$3,$4,1,1,1,1,100)',[line,tenant,order,product]);
      return receiving.confirmReceipt(actor,{clientOperationId:randomUUID(),warehouseId:warehouse,orderId:order,lines:[{orderLineId:line,cartons:1,lengthCm:100,widthCm:100,heightCm:110,weightKg:110,condition:'ok'}]});
    }
    await receive(1);
    const historical=(await pool.query('SELECT id,type,expected,actual FROM findings WHERE tenant_id=$1 ORDER BY id',[tenant])).rows;
    assert.equal(historical.length,2);
    await settings.updateTolerances(actor,{cbmTolerancePercent:20,weightTolerancePercent:20,expectedVersion:tolerance.version});
    await receive(2);
    assert.deepEqual((await pool.query('SELECT id,type,expected,actual FROM findings WHERE tenant_id=$1 ORDER BY id',[tenant])).rows,historical);
    const audits=(await pool.query('SELECT before,after FROM audit_events')).rows;
    assert.ok(!JSON.stringify(audits).includes('scrypt$'));
    assert.ok(!JSON.stringify(audits).includes(pass));
    await assert.rejects(()=>db.withTenant(tenant,survivor,c=>c.query('DELETE FROM audit_events')));
    assert.equal((await db.query('SELECT * FROM users')).rowCount,0); // No tenant context reveals no users.
    console.log('PASS: real Nest HTTP contracts/guards, migration/rerun, runtime RLS, all role denials, company isolation, assignments, cursor/search, password/status/session/realtime checks, concurrent owners, stale writes, tolerance boundaries, subsequent receipts and historical findings, audit redaction.');
  } finally {
    if(db) await db.onModuleDestroy();
    if(pool) await pool.end();
    await control.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await control.query(`DROP ROLE IF EXISTS "${role}"`);
    await control.end();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
