import { Command } from "commander";
import { explainEntity } from "../diagnostics/explain.js";
import { runDiscovery } from "../discovery/index.js";
import { setLogLevel } from "../platform/log.js";
import { doctorExitCode, renderDoctor } from "../render/doctor.js";
import { renderJson } from "../render/json.js";
import { renderWhy, renderWhyJson } from "../render/why.js";
import { findEntities } from "../runtime/query.js";

const VERSION = "0.1.0";

export async function run(argv: string[]): Promise<number> {
  let exitCode = 0;

  const program = new Command();
  program
    .name("devinscope")
    .version(VERSION)
    .description("See the Devin environment that actually runs.")
    .exitOverride();

  program
    .command("doctor")
    .description("Is my Devin environment configured coherently?")
    .option("--json", "machine-readable output")
    .option("--strict", "exit non-zero on MEDIUM diagnostics as well")
    .option("--verbose", "structured info logs on stderr")
    .option("--debug", "structured debug logs on stderr")
    .action(async (opts: { json?: boolean; strict?: boolean; verbose?: boolean; debug?: boolean }) => {
      if (opts.debug) setLogLevel("debug");
      else if (opts.verbose) setLogLevel("info");

      try {
        const graph = await runDiscovery({
          root: process.cwd(),
          ...(process.env.DEVINSCOPE_HOME ? { homeDir: process.env.DEVINSCOPE_HOME } : {}),
        });
        if (opts.json) {
          process.stdout.write(renderJson(graph));
        } else {
          process.stdout.write(renderDoctor(graph, { color: process.stdout.isTTY === true }));
        }
        exitCode = doctorExitCode(graph.diagnostics, opts.strict === true);
      } catch (err) {
        process.stderr.write(`discovery failed: ${(err as Error).message}\n`);
        exitCode = 3; // runtime/discovery failure (spec §25)
      }
    });

  program
    .command("why")
    .description("Why is this thing relevant to Devin here?")
    .argument("<thing>", "entity name, optionally kind-prefixed (skill:review, mcp:github, hook:PreToolUse:exec)")
    .option("--json", "machine-readable output")
    .option("--verbose", "structured info logs on stderr")
    .option("--debug", "structured debug logs on stderr")
    .action(async (thing: string, opts: { json?: boolean; verbose?: boolean; debug?: boolean }) => {
      if (opts.debug) setLogLevel("debug");
      else if (opts.verbose) setLogLevel("info");

      try {
        const graph = await runDiscovery({
          root: process.cwd(),
          ...(process.env.DEVINSCOPE_HOME ? { homeDir: process.env.DEVINSCOPE_HOME } : {}),
        });
        const result = findEntities(graph, thing);
        if (result.matches.length === 0) {
          const msg = [`No entity matches "${thing}".`];
          if (result.suggestions.length > 0) {
            msg.push("Did you mean:");
            for (const s of result.suggestions) msg.push(`  ${s}`);
          }
          process.stderr.write(msg.join("\n") + "\n");
          exitCode = 2; // invalid invocation / unknown entity (spec §25)
          return;
        }
        // config-key lookups (why config:permissions) headline the key, not the file name
        const entity = result.matches[0]!;
        const queriedName = thing.startsWith("config:") ? thing.slice("config:".length) : thing;
        const display = thing.startsWith("config:") && entity.name !== queriedName
          ? { ...entity, name: queriedName }
          : entity;
        const ex = explainEntity(graph, display);
        process.stdout.write(opts.json ? renderWhyJson(ex) : renderWhy(ex, { color: process.stdout.isTTY === true }));
        exitCode = 0;
      } catch (err) {
        process.stderr.write(`discovery failed: ${(err as Error).message}\n`);
        exitCode = 3;
      }
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (err) {
    // commander signals help/version via exitCode 0; unknown commands otherwise
    const code = (err as { exitCode?: number; message?: string }).exitCode;
    if (code === 0) return 0;
    process.stderr.write(`${(err as Error).message}\n`);
    return 2; // invalid invocation (spec §25)
  }

  return exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then(
    // set exitCode (not process.exit) so piped stdout/stderr flush fully
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`${String(err)}\n`);
      process.exitCode = 3;
    },
  );
}
