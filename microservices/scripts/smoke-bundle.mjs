#!/usr/bin/env node
/**
 * Bundle every service the way its Dockerfile does, then load the bundle.
 *
 * This exists because unit tests structurally cannot catch the bugs it catches.
 * Tests run from TypeScript source with node_modules present; production runs a
 * single esbuild CJS bundle with NO node_modules. Two real outages lived in that
 * gap:
 *
 *   1. `createRequire(import.meta.url)` at module scope. esbuild cannot provide
 *      `import.meta` in CJS output, so the argument was undefined and the call
 *      threw ERR_INVALID_ARG_VALUE while the module was still evaluating. The
 *      service died on startup. The bundle built fine; every test passed.
 *
 *   2. `getEventBus()` threw "ioredis is required" in a bundle, because the
 *      lazy require had no node_modules to resolve from. In the orders service
 *      that throw escaped a fire-and-forget publish and failed the ORDER.
 *
 * Both are invisible from source and obvious the moment you load the artifact.
 * REDIS_URL is set deliberately — bug 2 only appears on the Redis branch.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// esbuild's JS API rather than shelling out to npx: spawnSync cannot launch a
// .cmd shim on Windows without a shell (EINVAL), and this also skips npx's
// per-run download that the Dockerfiles pay for.
import { buildSync } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const servicesDir = join(root, "services");
const out = mkdtempSync(join(tmpdir(), "qlisted-smoke-"));

const services = readdirSync(servicesDir).filter((s) =>
  existsSync(join(servicesDir, s, "Dockerfile")) && existsSync(join(servicesDir, s, "src", "server.ts")),
);

if (services.length === 0) {
  console.error("no services found — did the layout change?");
  process.exit(1);
}

let failed = 0;

for (const svc of services) {
  const bundle = join(out, `${svc}.cjs`);
  try {
    // Mirrors each Dockerfile's esbuild invocation exactly.
    buildSync({
      entryPoints: [join(root, "services", svc, "src", "server.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bundle,
      absWorkingDir: root,
      logLevel: "silent",
    });
  } catch (err) {
    console.error(`FAIL ${svc}: bundle failed\n${err.message}`);
    failed++;
    continue;
  }

  try {
    // NODE_ENV=test so the service does not bind a port; REDIS_URL set so the
    // event bus takes its Redis branch, which is where bug 2 hid.
    // `process.exit(0)` immediately after require: the check is whether the
    // module evaluates, and some services (auth, gateway) call app.listen()
    // unconditionally, so they would otherwise keep the process alive forever.
    execFileSync(process.execPath, ["-e", `require(${JSON.stringify(bundle)}); process.exit(0);`], {
      cwd: out,
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "test", REDIS_URL: "redis://127.0.0.1:6379" },
      timeout: 60_000,
    });
    console.log(`ok   ${svc}`);
  } catch (err) {
    const detail = (err.stderr?.toString() || err.stdout?.toString() || err.message).trim();
    console.error(`FAIL ${svc}: bundle does not load\n${detail}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${services.length} service bundles failed to load.`);
  process.exit(1);
}
console.log(`\nall ${services.length} service bundles load.`);
