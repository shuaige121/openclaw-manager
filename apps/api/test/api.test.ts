import http from "node:http";
import assert from "node:assert/strict";
import test from "node:test";
import { createApiTestContext, createProjectFixture, expectJsonObject } from "./helpers";

test("GET /api/projects returns registry-backed items and stopped probe status", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });
  const project = await createProjectFixture(api.tempDir, {
    id: "probe-target",
    gatewayPort: 19931,
  });

  await api.request.post("/api/projects").send(project).expect(201);

  const response = await api.request.get("/api/projects").expect(200);

  assert.equal(response.body.source, "registry");
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, "probe-target");
  assert.equal(response.body.items[0].runtimeStatus, "stopped");
  assert.equal(response.body.items[0].healthStatus, "unknown");
});

test("project registry CRUD routes append history entries", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });

  const fixture = await createProjectFixture(api.tempDir, {
    id: "registry-target",
    gatewayPort: 19932,
  });

  await api.request.post("/api/projects").send(fixture).expect(201);
  await api.request
    .patch("/api/projects/registry-target")
    .send({ name: "Registry Target Updated" })
    .expect(200);
  await api.request.delete("/api/projects/registry-target").expect(204);

  const history = await api.request.get("/api/actions?projectId=registry-target&limit=5").expect(200);

  assert.equal(history.body.totalItems, 3);
  assert.deepEqual(
    history.body.items.map((item: { actionName: string }) => item.actionName),
    ["project_delete", "project_update", "project_create"],
  );
});

test("project action route executes lifecycle command and records stdout in history", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });
  const project = await createProjectFixture(api.tempDir, {
    id: "action-target",
    gatewayPort: 19933,
    lifecycle: {
      startCommand: "printf action-started",
    },
  });

  await api.request.post("/api/projects").send(project).expect(201);

  const actionResponse = await api.request.post("/api/projects/action-target/actions/start").expect(200);

  assert.equal(actionResponse.body.ok, true);
  assert.equal(actionResponse.body.result.stdout, "action-started");

  const history = await api.request.get("/api/actions?projectId=action-target&limit=3").expect(200);

  assert.equal(history.body.items[0].actionName, "start");
  assert.match(history.body.items[0].command, /printf action-started/);
  assert.equal(history.body.items[0].stdout, "action-started");
});

test("bulk action route updates files and records bulk history", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });
  const project = await createProjectFixture(api.tempDir, {
    id: "bulk-target",
    gatewayPort: 19934,
  });

  await api.request.post("/api/projects").send(project).expect(201);

  await api.request
    .post("/api/bulk/execute")
    .send({
      action: "hooks",
      projectIds: ["bulk-target"],
      payload: {
        mode: "enable",
        hookName: "daily-summary",
      },
    })
    .expect(200);

  await api.request
    .post("/api/bulk/execute")
    .send({
      action: "memory",
      projectIds: ["bulk-target"],
      payload: {
        mode: "append",
        blockId: "bulk-history-block",
        content: "remember this test line",
      },
    })
    .expect(200);

  const config = await api.readProjectConfig("bulk-target");
  const hooks = expectJsonObject(config.hooks);
  const internal = expectJsonObject(hooks.internal);
  const entries = expectJsonObject(internal.entries);
  const dailySummary = expectJsonObject(entries["daily-summary"]);

  assert.equal(internal.enabled, true);
  assert.equal(dailySummary.enabled, true);

  const memory = await api.readProjectMemory("bulk-target");
  assert.match(memory, /bulk-history-block/);
  assert.match(memory, /remember this test line/);

  const history = await api.request.get("/api/actions?projectId=bulk-target&limit=5").expect(200);
  assert.equal(history.body.items[0].kind, "bulk_action");
  assert.match(history.body.items[0].summary, /Memory append block bulk-history-block/);
  assert.equal(history.body.items[1].kind, "bulk_action");
  assert.match(history.body.items[1].summary, /Hook daily-summary -> enable/);
});

test("compatibility scan route classifies partial projects and persists the result", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });
  const project = await createProjectFixture(api.tempDir, {
    id: "compat-target",
    gatewayPort: 19935,
    config: {
      gateway: {
        port: 19935,
      },
      hooks: {
        internal: {
          enabled: false,
          entries: {},
        },
      },
    },
  });

  await api.request.post("/api/projects").send(project).expect(201);

  const scanResponse = await api.request
    .post("/api/projects/compat-target/scan-compatibility")
    .expect(200);

  assert.equal(scanResponse.body.ok, true);
  assert.equal(scanResponse.body.compatibility.status, "runtime_only");
  assert.equal(
    scanResponse.body.compatibility.checks.find((check: { name: string }) => check.name === "skills")
      ?.supported,
    false,
  );

  const detailResponse = await api.request.get("/api/projects/compat-target").expect(200);

  assert.equal(detailResponse.body.registry.compatibility.status, "runtime_only");

  const history = await api.request.get("/api/actions?projectId=compat-target&limit=5").expect(200);

  assert.equal(history.body.items[0].actionName, "compatibility_scan");
});

test("HTML fallback health endpoints are reported as running but degraded", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
  });
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end("<!doctype html><title>fallback</title>");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  context.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP port.");
  }

  const project = await createProjectFixture(api.tempDir, {
    id: "html-fallback-target",
    gatewayPort: address.port,
  });

  await api.request.post("/api/projects").send(project).expect(201);

  const response = await api.request.get("/api/projects").expect(200);
  const item = response.body.items.find((entry: { id: string }) => entry.id === "html-fallback-target");

  assert.equal(item.runtimeStatus, "running");
  assert.equal(item.healthStatus, "degraded");

  const compatibility = await api.request
    .post("/api/projects/html-fallback-target/scan-compatibility")
    .expect(200);

  assert.equal(
    compatibility.body.compatibility.checks.find((check: { name: string }) => check.name === "gateway_probe")
      ?.supported,
    false,
  );
});

test("IP allowlist blocks non-allowlisted clients when trust proxy is enabled", async (context) => {
  const api = await createApiTestContext(context, {
    projects: [],
    accessControl: {
      allowedIps: ["192.168.7.6"],
      trustProxy: true,
    },
  });

  await api.request
    .get("/api/projects")
    .set("X-Forwarded-For", "192.168.7.10")
    .expect(403);

  const allowedResponse = await api.request
    .get("/api/projects")
    .set("X-Forwarded-For", "192.168.7.6")
    .expect(200);

  assert.equal(allowedResponse.body.source, "registry");
});
