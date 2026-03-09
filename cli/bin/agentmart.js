#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setPrivateKey } from "./config.js";

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
  ]) {
    program
      .command(commandName)
      .description(`${commandName} command`)
      .action(() => {
        console.log(`${commandName} command is not yet implemented`);
      });
  }

  program
    .command("config")
    .description("Manage CLI config")
    .command("set")
    .description("Set config values")
    .command("private-key <key>")
    .description("Set wallet private key")
    .action(async (key) => {
      const configFilePath = await setPrivateKey(key);
      console.log(`Saved private key to ${configFilePath}`);
    });

  return program;
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  createProgram().parseAsync(process.argv);
}
