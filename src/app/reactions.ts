export const REACTION_OPTIONS = [
  { content: "+1", emoji: "👍" },
  { content: "heart", emoji: "❤️" },
  { content: "rocket", emoji: "🚀" },
  { content: "eyes", emoji: "👀" },
  { content: "hooray", emoji: "🎉" }
] as const;

export function reactionIndexForContent(content: string): number {
  return REACTION_OPTIONS.findIndex((reaction) => reaction.content === content);
}
