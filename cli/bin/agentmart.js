#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createProgram() {
  const program = new Command();

  program.name("agentmart").description("AgentMart CLI");

  for (const commandName of [
    "register",
    "recover",
    "upload",
    "search",
    "list",
    "buy",
    "updates",
    "me",
    "config",
  ]) {
    program
      .command(commandName)
      .description(`${commandName} command`)
      .action(() => {
        console.log(`${commandName} command is not yet implemented`);
      });
  }

  return program;
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  createProgram().parseAsync(process.argv);
}
