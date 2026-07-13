import { artifactDataPath, artifactDataUrl, artifactAnnotationsPath, artifactAnnotationsUrl } from "@/lib/artifacts/paths"

const expectedData = "/data/artifacts/project/slug/artifact.json"
const expectedAnnotations = "/data/artifacts/project/slug/annotations.json"

if (artifactDataPath("project", "slug") !== expectedData) {
  throw new Error(
    `artifactDataPath mismatch: got ${artifactDataPath("project", "slug")}, expected ${expectedData}`,
  )
}

if (!artifactDataUrl("project", "slug").endsWith(expectedData)) {
  throw new Error(
    `artifactDataUrl mismatch: got ${artifactDataUrl("project", "slug")}, expected to end with ${expectedData}`,
  )
}

if (artifactAnnotationsPath("project", "slug") !== expectedAnnotations) {
  throw new Error(
    `artifactAnnotationsPath mismatch: got ${artifactAnnotationsPath("project", "slug")}, expected ${expectedAnnotations}`,
  )
}

if (!artifactAnnotationsUrl("project", "slug").endsWith(expectedAnnotations)) {
  throw new Error(
    `artifactAnnotationsUrl mismatch: got ${artifactAnnotationsUrl("project", "slug")}, expected to end with ${expectedAnnotations}`,
  )
}

// Prove the old flat project/slug.json shape is no longer the required read path.
const oldFlat = "/data/artifacts/project/slug.json"
if (artifactDataPath("project", "slug") === oldFlat) {
  throw new Error(`artifactDataPath must not use the old flat layout: ${oldFlat}`)
}

console.log("Bundle path helpers are correct.")
