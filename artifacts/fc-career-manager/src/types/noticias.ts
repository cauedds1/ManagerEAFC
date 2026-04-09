export type CommentPersonality =
  | "otimista"
  | "chato"
  | "corneteiro"
  | "zoeiro"
  | "saudosista"
  | "neutro"
  | "internacional";

export type NewsSource = "tnt" | "espn" | "fanpage";

export type NewsCategory =
  | "resultado"
  | "lesao"
  | "transferencia"
  | "renovacao"
  | "treino"
  | "conquista"
  | "geral";

export interface NewsComment {
  id: string;
  username: string;
  displayName: string;
  content: string;
  likes: number;
  personality?: CommentPersonality;
  replies?: NewsComment[];
  createdAt: number;
}

export interface NewsPost {
  id: string;
  careerId: string;
  source: NewsSource;
  sourceHandle: string;
  sourceName: string;
  content: string;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  comments: NewsComment[];
  createdAt: number;
  matchId?: string;
  category: NewsCategory;
}
