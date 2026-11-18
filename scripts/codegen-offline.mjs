// Generates convex/_generated without a Convex deployment.
//
// `npx convex dev` (or `npx convex codegen` with a deployment configured) is the
// normal way to generate these files and will overwrite this output. This script
// exists for environments that can't reach Convex: it runs the local-only
// codegen and then adds the `components` export for the components mounted in
// convex/convex.config.ts.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execSync("npx convex codegen --system-udfs --typecheck disable", {
  stdio: "inherit",
});

const components = {
  auth: "@convex-dev/auth/_generated/component.js",
  authPassword: "@convex-dev/auth/components/password/_generated/component.js",
  authUsername: "@convex-dev/auth/components/username/_generated/component.js",
  geospatial: "@convex-dev/geospatial/_generated/component.js",
};

const dts = "convex/_generated/api.d.ts";
const js = "convex/_generated/api.js";

let types = readFileSync(dts, "utf8");
if (!types.includes("export declare const components")) {
  const entries = Object.entries(components)
    .map(
      ([name, path]) =>
        `  ${name}: import("${path}").ComponentApi<"${name}">;`,
    )
    .join("\n");
  types += `\nexport declare const components: {\n${entries}\n};\n`;
  writeFileSync(dts, types);
}

let code = readFileSync(js, "utf8");
if (!code.includes("componentsGeneric")) {
  code = code.replace(
    'import { anyApi } from "convex/server";',
    'import { anyApi, componentsGeneric } from "convex/server";',
  );
  code += "\nexport const components = componentsGeneric();\n";
  writeFileSync(js, code);
}

console.log("convex/_generated written (offline mode).");
