// Project Management API Types
export type Project = {
  userId: string;      // Partition key
  projectId: string;   // Sort key
  name: string;
  description: string; // Text field suitable for translation
  category: string;
  startDate: string;   // Date in ISO format
  endDate: string;     // Date in ISO format
  budget: number;      // Numeric field
  completed: boolean;  // Boolean field
  priority: number;    // Numeric field 1-5
  tags: string[];      // Array of strings
  createdAt: string;   // Timestamp
  updatedAt: string;   // Timestamp
  translations?: Record<string, string>; // Map of language code to translated description
}

export type ProjectQueryParams = {
  userId: string;      // Required partition key
  category?: string;   // Optional filter parameter
  completed?: boolean; // Optional filter parameter
}

export type TranslationRequest = {
  language: string;    // Target language code (e.g., 'fr', 'es', 'de')
}