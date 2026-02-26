export type PublicEnv = {
  appEnv: 'development' | 'production';
  apiBaseUrl: string;
  apiPrefix: string;
  enableFirebaseHealthTest: boolean;
};

export const publicEnv: PublicEnv = {
  appEnv: "development",
  apiBaseUrl: "http://localhost:3000",
  apiPrefix: "/api/v1",
  enableFirebaseHealthTest: false,
};
