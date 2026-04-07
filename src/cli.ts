import { readFile } from "node:fs/promises";
import { OpenAICompatibleClient } from "./lib/server/openai.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const baseUrl = process.env.SLOPBLOCK_BASE_URL;
  const apiKey = process.env.SLOPBLOCK_API_KEY;
  const model = process.env.SLOPBLOCK_MODEL ?? "anthropic/claude-sonnet-4.5";

  if (!apiKey || !baseUrl) {
    throw new Error("Set SLOPBLOCK_API_KEY and SLOPBLOCK_BASE_URL before using the CLI.");
  }

  const client = new OpenAICompatibleClient({ baseUrl, apiKey, model });
  if (command === "skip") {
    const diffSummary = await readFile(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const changedFiles = (await readFile(readArg("--files") ?? "fixtures/files.txt", "utf8"))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const result = await client.evaluateBorderlineSkip({ diffSummary, changedFiles });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "quiz") {
    const diffSummary = await readFile(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const repoContext = JSON.parse(
      await readFile(readArg("--context") ?? "fixtures/context.json", "utf8"),
    );
    const questionCount = Number(readArg("--questions") ?? "3");
    const quiz = await client.generateQuiz({ diffSummary, repoContext, questionCount });
    const validation = await client.validateQuiz({
      quiz,
      repoContext,
      diffSummary,
      expectedQuestionCount: questionCount,
    });
    process.stdout.write(`${JSON.stringify({ quiz, validation }, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    "Usage: slopblock <skip|quiz> [--diff path] [--files path] [--context path] [--questions n]\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
