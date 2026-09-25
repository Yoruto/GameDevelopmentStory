"use strict";

const http = require("http");
const tcb = require("@cloudbase/node-sdk");
const { createHandler } = require("./api");

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID,
  accessKey: process.env.COLORBOX__ACCESS_KEY
});
const rdb = app.rdb({ database: "public" });

async function atomicUpsert(puid, save) {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) throw new Error("cloud environment unavailable");
  const token = process.env.COLORBOX__ACCESS_KEY;
  if (!token) throw new Error("database service credential unavailable");
  const response = await fetch(
    `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/upsert_game_save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
        "X-Db-Instance": "default",
        "Accept-Profile": "public",
        "Content-Profile": "public"
      },
      body: JSON.stringify({
        p_puid: puid,
        p_expected_revision: save.expectedRevision,
        p_company_name: save.companyName,
        p_year: save.year,
        p_month: save.month,
        p_phase: save.phase,
        p_save_json: save.saveJson
      })
    }
  );
  if (!response.ok) throw new Error(`database upsert failed (${response.status})`);
  const body = await response.json();
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row.conflicted !== "boolean") throw new Error("invalid database response");
  return { revision: row.revision, updatedAt: row.updated_at, conflicted: row.conflicted };
}

const handler = createHandler({
  getSave: async function (puid) {
    const result = await rdb.from("game_saves")
      .select("company_name,year,month,phase,save_json,revision,updated_at")
      .eq("puid", puid).limit(1);
    if (result.error) throw new Error("database query failed");
    const row = result.data && result.data[0];
    return row ? {
      companyName: row.company_name,
      year: row.year,
      month: row.month,
      phase: row.phase,
      saveJson: row.save_json,
      revision: Number(row.revision || 0),
      updatedAt: row.updated_at
    } : null;
  },
  upsertSave: atomicUpsert
});

http.createServer(handler).listen(process.env.PORT || 9000);
