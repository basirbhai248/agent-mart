#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setPrivateKey } from "./config.js";
import { createBuyAction } from "./buy.js";
import { createListAction } from "./list.js";
import { createMeAction } from "./me.js";
import { createRecoverAction } from "./recover.js";
import { createRegisterAction } from "./register.js";
import { createSearchAction } from "./search.js";
import { createUpdatesAction } from "./updates.js";
import { createUploadAction } from "./upload.js";

const BUY_COMMAND_NAME = "buy";

export function createProgram() {
  const program = new Command();

  program.name("agentmart").description("AgentMart CLI");

  program
    .command("register")
    .description("Register as a creator and pay the one-time creator fee")
    .requiredOption("--wallet <addr>", "Creator wallet address")
    .requiredOption("--name <name>", "Creator display name")
    .requiredOption("--bio <bio>", "Creator bio")
    .action(createRegisterAction());

  program
    .command("recover")
    .description("Recover your API key with a wallet signature")
    .requiredOption("--wallet <addr>", "Creator wallet address")
    .requiredOption("--signature <sig>", "Recovery message signature")
    .action(createRecoverAction());

  program
    .command("upload <file>")
    .description("Create a listing from a file")
    .requiredOption("--title <title>", "Listing title")
    .requiredOption("--description <desc>", "Listing description")
    .requiredOption("--price <usdc>", "Listing price in USDC")
    .option("--api-key <key>", "Creator API key (or set AGENTMART_API_KEY)")
    .action(createUploadAction());

  program
    .command("search <query>")
    .description("Search listings")
    .action(createSearchAction());

  program
    .command("list")
    .description("List listings by creator wallet")
    .requiredOption("--creator <wallet>", "Creator wallet address")
    .action(createListAction());

  program
    .command(`${BUY_COMMAND_NAME} <listing-id>`)
    .description("Buy a listing and save its content to a local file")
    .option("--output <file>", "Output file path")
    .action(createBuyAction());

  program
    .command("me")
    .description("Show your creator profile from stored API key")
    .action(createMeAction());

  program
    .command("updates")
    .description("Check for updates to previously purchased listings")
    .action(createUpdatesAction());

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
