import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/assistant", "routes/api/assistant.ts"),
  route("api/discover-match", "routes/api/discover-match.ts"),
  route("app", "routes/app.tsx", [
    index("routes/appInfo/index.tsx"),
    route("pantry", "routes/appInfo/pantry.tsx"),
    route("assistant", "routes/appInfo/assistant.tsx"),
    route("discover", "routes/discover.tsx"),
    route("settings", "routes/settings.tsx"),
    route("recipes", "routes/appInfo/recipes.tsx", [
      route(":recipeId", "routes/appInfo/recipes/$recipeId.tsx"),
    ]),
  ]),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("validate-magic-link", "routes/validate-magic-link.tsx"),
] satisfies RouteConfig;
