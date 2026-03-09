function parseCommandSpec(spec) {
  const parts = String(spec).trim().split(/\s+/);
  const name = parts.shift() ?? "";
  return { name, usage: [name, ...parts].join(" "), args: parts };
}

function parseOptionFlags(flags) {
  return String(flags)
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function formatOptionUsage(option) {
  const placeholder = option.flags.match(/<[\w-]+>/)?.[0] ?? "";
  return `${option.flags}${placeholder ? " " : ""}`.trim();
}

export class Command {
  constructor() {
    this._name = "";
    this._description = "";
    this._commands = [];
    this._options = [];
    this._action = null;
    this._parent = null;
    this._spec = { name: "", usage: "", args: [] };
  }

  name(value) {
    if (value === undefined) {
      return this._name;
    }

    this._name = value;
    if (!this._spec.name) {
      this._spec.name = value;
      this._spec.usage = value;
    }
    return this;
  }

  description(value) {
    if (value === undefined) {
      return this._description;
    }

    this._description = value;
    return this;
  }

  command(spec) {
    const child = new Command();
    child._parent = this;
    child._spec = parseCommandSpec(spec);
    child._name = child._spec.name;
    this._commands.push(child);
    return child;
  }

  requiredOption(flags, description) {
    this._options.push({ flags, description, required: true, names: parseOptionFlags(flags) });
    return this;
  }

  option(flags, description) {
    this._options.push({ flags, description, required: false, names: parseOptionFlags(flags) });
    return this;
  }

  action(handler) {
    this._action = handler;
    return this;
  }

  async parseAsync(argv) {
    const tokens = argv.slice(2);
    await this._run(tokens);
  }

  async _run(tokens) {
    const first = tokens[0];

    if (!first || first === "--help" || first === "-h") {
      this._printHelp();
      return;
    }

    const subcommand = this._commands.find((command) => command._spec.name === first);
    if (subcommand) {
      await subcommand._run(tokens.slice(1));
      return;
    }

    if (this._commands.length > 0) {
      throw new Error(`Unknown command: ${first}`);
    }

    if (tokens.includes("--help") || tokens.includes("-h")) {
      this._printHelp();
      return;
    }

    const parsed = this._parseLeafArgs(tokens);
    if (this._action) {
      await this._action(...parsed.args, parsed.options);
      return;
    }

    this._printHelp();
  }

  _parseLeafArgs(tokens) {
    const options = {};
    const args = [];

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (!token.startsWith("-")) {
        args.push(token);
        continue;
      }

      const option = this._options.find((item) => item.names.includes(token));
      if (!option) {
        throw new Error(`Unknown option: ${token}`);
      }

      if (option.flags.includes("<")) {
        const value = tokens[index + 1];
        if (!value || value.startsWith("-")) {
          throw new Error(`Option ${token} requires a value`);
        }

        options[this._optionKey(option)] = value;
        index += 1;
      } else {
        options[this._optionKey(option)] = true;
      }
    }

    for (const option of this._options) {
      if (option.required && !(this._optionKey(option) in options)) {
        throw new Error(`Missing required option: ${option.flags}`);
      }
    }

    return { args, options };
  }

  _optionKey(option) {
    const match = option.flags.match(/--([\w-]+)/);
    return (match?.[1] ?? "option").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  _fullCommandPath() {
    const names = [];
    let cursor = this;
    while (cursor) {
      if (cursor._parent) {
        names.unshift(cursor._spec.name);
      } else if (cursor._name) {
        names.unshift(cursor._name);
      }
      cursor = cursor._parent;
    }
    return names.join(" ").trim();
  }

  _printHelp() {
    const commandPath = this._fullCommandPath();
    const usageTail = this._commands.length > 0 ? "<command>" : this._spec.args.join(" ");
    const usage = [commandPath, usageTail].filter(Boolean).join(" ");

    console.log(`Usage: ${usage}`);
    if (this._description) {
      console.log(`\n${this._description}`);
    }

    if (this._commands.length > 0) {
      console.log("\nCommands:");
      for (const command of this._commands) {
        const label = command._spec.usage;
        const description = command._description || "";
        console.log(`  ${label}${description ? `\t${description}` : ""}`);
      }
    }

    if (this._options.length > 0) {
      console.log("\nOptions:");
      for (const option of this._options) {
        const label = formatOptionUsage(option);
        console.log(`  ${label}${option.description ? `\t${option.description}` : ""}`);
      }
    }
  }
}
