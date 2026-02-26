export type OpenApiTag = {
  name: string;
  description?: string;
};

export type OpenApiSchema = Record<string, unknown>;
export type OpenApiPathItem = Record<string, unknown>;

export type OpenApiModule = {
  tags?: OpenApiTag[];
  paths?: Record<string, OpenApiPathItem>;
  schemas?: Record<string, OpenApiSchema>;
};
