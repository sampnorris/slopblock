/**
 * JSON Schema tool definitions for structured LLM output.
 *
 * Each schema is used as a "tool" in the OpenAI-compatible tool-calling API so
 * the model is forced to produce conforming JSON rather than free-text.
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const skipDecisionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "submit_skip_decision",
    description: "Submit the skip/quiz decision for this pull request.",
    parameters: {
      type: "object",
      required: ["outcome", "reason", "certainty"],
      additionalProperties: false,
      properties: {
        outcome: {
          type: "string",
          enum: ["skip", "quiz"],
          description: "Whether the PR should skip the quiz or require one."
        },
        reason: {
          type: "string",
          description: "One sentence explaining the decision."
        },
        certainty: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Confidence level of the decision."
        }
      }
    }
  }
};

export const quizPayloadTool: ToolDefinition = {
  type: "function",
  function: {
    name: "submit_quiz",
    description: "Submit the generated PR comprehension quiz.",
    parameters: {
      type: "object",
      required: ["summary", "questions"],
      additionalProperties: false,
      properties: {
        summary: {
          type: "string",
          description: "A brief markdown summary of the pull request changes."
        },
        questions: {
          type: "array",
          description: "The quiz questions.",
          items: {
            type: "object",
            required: ["id", "prompt", "options", "correctOption", "explanation", "diffAnchors", "focus"],
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                description: "Unique question identifier, e.g. q1, q2."
              },
              prompt: {
                type: "string",
                description: "The question text in markdown."
              },
              options: {
                type: "array",
                description: "Exactly 3 answer options.",
                items: {
                  type: "object",
                  required: ["key", "text"],
                  additionalProperties: false,
                  properties: {
                    key: {
                      type: "string",
                      enum: ["A", "B", "C"],
                      description: "Option letter."
                    },
                    text: {
                      type: "string",
                      description: "Option text in markdown."
                    }
                  }
                }
              },
              correctOption: {
                type: "string",
                enum: ["A", "B", "C"],
                description: "The key of the correct option."
              },
              explanation: {
                type: "string",
                description: "Markdown explanation of why the correct answer is right."
              },
              diffAnchors: {
                type: "array",
                description: "Changed file paths or symbols this question references.",
                items: { type: "string" }
              },
              focus: {
                type: "string",
                enum: ["behavior", "risk", "implementation"],
                description: "The category of this question."
              }
            }
          }
        }
      }
    }
  }
};

export const quizValidationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "submit_validation",
    description: "Submit the quiz validation result.",
    parameters: {
      type: "object",
      required: ["valid", "issues"],
      additionalProperties: false,
      properties: {
        valid: {
          type: "boolean",
          description: "Whether the quiz passes validation."
        },
        issues: {
          type: "array",
          description: "List of serious structural or factual errors found. Empty array if valid.",
          items: { type: "string" }
        }
      }
    }
  }
};
