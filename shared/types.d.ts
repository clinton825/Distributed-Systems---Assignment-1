export type Project = {
  userId: string;
  projectId: string;
  name: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  budget: number;
  completed: boolean;
  priority: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  translations?: Record<string, string>;
}

export type ProjectQueryParams = {
  userId: string;
  category?: string;
  completed?: boolean;
}

export type TranslationRequest = {
  language: string;
}