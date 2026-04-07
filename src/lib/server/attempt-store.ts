import { prisma } from "./db.js";
import type { SessionRecord } from "./session-store.js";

export interface GradedQuizAttempt {
  answers: Record<string, string>;
  questionCount: number;
  correctCount: number;
  passed: boolean;
}

export function gradeQuizAnswers(
  session: SessionRecord,
  rawAnswers: Record<string, unknown>,
): GradedQuizAttempt {
  const questions = session.quiz?.questions ?? [];

  if (questions.length === 0) {
    throw new Error("No quiz is available for this session.");
  }

  const answers: Record<string, string> = {};
  let correctCount = 0;

  for (const question of questions) {
    const selected = rawAnswers[question.id];
    if (typeof selected !== "string" || !selected.trim()) {
      throw new Error(`Missing answer for question ${question.id}.`);
    }

    const answer = selected.trim().toUpperCase();
    answers[question.id] = answer;
    if (answer === question.correctOption) {
      correctCount += 1;
    }
  }

  return {
    answers,
    questionCount: questions.length,
    correctCount,
    passed: correctCount === questions.length,
  };
}

export interface AttemptStats {
  totalAttempts: number;
  passedAttempts: number;
  failedAttempts: number;
  uniqueAuthors: number;
}

export async function getAttemptStats(installationId: string): Promise<AttemptStats> {
  const [total, passed, authors] = await Promise.all([
    prisma.quizAttempt.count({ where: { installationId } }),
    prisma.quizAttempt.count({ where: { installationId, passed: true } }),
    prisma.quizAttempt.groupBy({
      by: ["authorLogin"],
      where: { installationId },
      _count: true,
    }),
  ]);

  return {
    totalAttempts: total,
    passedAttempts: passed,
    failedAttempts: total - passed,
    uniqueAuthors: authors.length,
  };
}

export async function createQuizAttempt(
  session: SessionRecord,
  graded: GradedQuizAttempt,
): Promise<{ attemptNumber: number }> {
  const sessionId = session.id;

  return await prisma.$transaction(async (tx) => {
    const attemptNumber =
      (await tx.quizAttempt.count({
        where: sessionId
          ? { sessionId }
          : {
              repositoryOwner: session.repositoryOwner,
              repositoryName: session.repositoryName,
              pullNumber: session.pullNumber,
            },
      })) + 1;

    await tx.quizAttempt.create({
      data: {
        sessionId,
        installationId: String(session.installationId),
        repositoryId: String(session.repositoryId),
        repositoryOwner: session.repositoryOwner,
        repositoryName: session.repositoryName,
        pullNumber: session.pullNumber,
        authorLogin: session.authorLogin,
        headSha: session.headSha,
        attemptNumber,
        retryMode: session.retryMode,
        generationModel: session.generationModel,
        validationModel: session.validationModel,
        questionCount: graded.questionCount,
        correctCount: graded.correctCount,
        passed: graded.passed,
        answers: graded.answers,
      },
    });

    return { attemptNumber };
  });
}
