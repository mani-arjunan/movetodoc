const env = process.env;

export const environment = {
  PORT: env.PORT || 3000,
  GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || "",
  REDIRECT_URI: env.REDIRECT_URI || "",
  HOST: env.HOST || "localhost",
};
