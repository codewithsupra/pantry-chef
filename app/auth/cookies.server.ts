import { createCookie } from "react-router";

if (!process.env.AUTH_COOKIE_SECRET) {
  throw new Error("AUTH_COOKIE_SECRET env variable is not set");
}

export const sessionCookie = createCookie("remix-recipes__session", {
  secrets: [process.env.AUTH_COOKIE_SECRET],
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
});
