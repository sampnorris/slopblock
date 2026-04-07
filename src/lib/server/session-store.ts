import { SessionStatus } from "@prisma/client";
import type { QuizPayload, RetryMode } from "./types.js";
import { prisma } from "./db.js";

export interface SessionRecord {
  id?: string;
  installationId: number;
  repositoryId: number;
  repositoryOwner: string;
  repositoryName: string;
  pullNumber: number;
  authorLogin: string;
  headSha: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionCount: number;
  retryMode: RetryMode;
  allowedWrongAnswers?: number;
  generationModel?: string;
  validationModel?: string;
  summary?: string;
  skipReason?: string;
  failureMessage?: string;
  commentId?: number;
  quiz?: QuizPayload;
  traceId?: string;
}

function fromRow(row: any): SessionRecord {
  return {
    id: row.id,
    installationId: Number(row.installationId),
    repositoryId: Number(row.repositoryId),
    repositoryOwner: row.repositoryOwner,
    repositoryName: row.repositoryName,
    pullNumber: row.pullNumber,
    authorLogin: row.authorLogin,
    headSha: row.headSha,
    status: row.status,
    currentQuestionIndex: row.currentQuestionIndex,
    questionCount: row.questionCount,
    retryMode: row.retryMode as RetryMode,
    allowedWrongAnswers: (row as any).allowedWrongAnswers ?? undefined,
    generationModel: row.generationModel ?? undefined,
    validationModel: row.validationModel ?? undefined,
    summary: row.summary ?? undefined,
    skipReason: row.skipReason ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    commentId: row.commentId ? Number(row.commentId) : undefined,
    quiz: (row.quiz as QuizPayload | null) ?? undefined,
    traceId: row.traceId ?? undefined,
  };
}

export async function getSession(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<SessionRecord | undefined> {
  const row = await prisma.pullRequestSession.findUnique({
    where: {
      repositoryOwner_repositoryName_pullNumber: {
        repositoryOwner: owner,
        repositoryName: repo,
        pullNumber,
      },
    },
  });

  return row ? fromRow(row) : undefined;
}

export async function getSessionById(id: string): Promise<SessionRecord | undefined> {
  const row = await prisma.pullRequestSession.findUnique({ where: { id } });
  return row ? fromRow(row) : undefined;
}

export async function deleteSession(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<boolean> {
  try {
    await prisma.pullRequestSession.delete({
      where: {
        repositoryOwner_repositoryName_pullNumber: {
          repositoryOwner: owner,
          repositoryName: repo,
          pullNumber,
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

export interface SessionListItem {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  pullNumber: number;
  authorLogin: string;
  headSha: string;
  status: SessionStatus;
  questionCount: number;
  generationModel?: string;
  summary?: string;
  skipReason?: string;
  failureMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionStats {
  total: number;
  awaiting: number;
  passed: number;
  failed: number;
  skipped: number;
  budgetExceeded: number;
}

export async function listSessionsByInstallation(
  installationId: string,
  limit = 50,
  offset = 0,
): Promise<SessionListItem[]> {
  const rows = await prisma.pullRequestSession.findMany({
    where: { installationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      repositoryOwner: true,
      repositoryName: true,
      pullNumber: true,
      authorLogin: true,
      headSha: true,
      status: true,
      questionCount: true,
      generationModel: true,
      summary: true,
      skipReason: true,
      failureMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    generationModel: r.generationModel ?? undefined,
    summary: r.summary ?? undefined,
    skipReason: r.skipReason ?? undefined,
    failureMessage: r.failureMessage ?? undefined,
  }));
}

export async function getSessionStats(installationId: string): Promise<SessionStats> {
  const counts = await prisma.pullRequestSession.groupBy({
    by: ["status"],
    where: { installationId },
    _count: true,
  });

  const map = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  // Count budget-exceeded sessions by checking for the failureMessage pattern
  const budgetExceeded = await prisma.pullRequestSession.count({
    where: {
      installationId,
      failureMessage: { contains: "Token budget exceeded" },
    },
  });

  return {
    total: Object.values(map).reduce((a, b) => a + b, 0),
    awaiting: map[SessionStatus.awaiting_answer] ?? 0,
    passed: map[SessionStatus.passed] ?? 0,
    failed: map[SessionStatus.failed] ?? 0,
    skipped: map[SessionStatus.skipped] ?? 0,
    budgetExceeded,
  };
}

export async function deleteStaleSessions(olderThanDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.pullRequestSession.deleteMany({
    where: {
      updatedAt: { lt: cutoff },
      status: { in: [SessionStatus.passed, SessionStatus.skipped, SessionStatus.failed] },
    },
  });

  return result.count;
}

export async function upsertSession(input: SessionRecord): Promise<SessionRecord> {
  const row = await prisma.pullRequestSession.upsert({
    where: {
      repositoryOwner_repositoryName_pullNumber: {
        repositoryOwner: input.repositoryOwner,
        repositoryName: input.repositoryName,
        pullNumber: input.pullNumber,
      },
    },
    create: {
      installationId: String(input.installationId),
      repositoryId: String(input.repositoryId),
      repositoryOwner: input.repositoryOwner,
      repositoryName: input.repositoryName,
      pullNumber: input.pullNumber,
      authorLogin: input.authorLogin,
      headSha: input.headSha,
      status: input.status,
      currentQuestionIndex: input.currentQuestionIndex,
      questionCount: input.questionCount,
      retryMode: input.retryMode,
      allowedWrongAnswers: input.allowedWrongAnswers ?? 0,
      generationModel: input.generationModel,
      validationModel: input.validationModel,
      summary: input.summary,
      skipReason: input.skipReason,
      failureMessage: input.failureMessage,
      commentId: input.commentId ? String(input.commentId) : undefined,
      quiz: input.quiz as unknown as object | undefined,
      traceId: input.traceId,
    } as any,
    update: {
      installationId: String(input.installationId),
      repositoryId: String(input.repositoryId),
      authorLogin: input.authorLogin,
      headSha: input.headSha,
      status: input.status,
      currentQuestionIndex: input.currentQuestionIndex,
      questionCount: input.questionCount,
      retryMode: input.retryMode,
      allowedWrongAnswers: input.allowedWrongAnswers ?? 0,
      generationModel: input.generationModel,
      validationModel: input.validationModel,
      summary: input.summary,
      skipReason: input.skipReason,
      failureMessage: input.failureMessage,
      commentId: input.commentId ? String(input.commentId) : null,
      quiz: input.quiz as unknown as object | undefined,
      traceId: input.traceId ?? null,
    } as any,
  });

  return fromRow(row);
}
