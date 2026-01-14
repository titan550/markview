import { defineConfig } from "vite";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isPagesRoot = repo ? repo.endsWith(".github.io") : false;
const base = process.env.BASE_PATH || (repo && !isPagesRoot ? `/${repo}/` : "/");

export default defineConfig({
  base,
});
