import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { saveProfile, loadProfile, deleteProfile } from "./storage";
import { demoDetails, type PlanProfile } from "./plan";
it("persists, updates, and deletes a profile including original document blobs", async () => {
  const profile: PlanProfile = {
    schemaVersion: 1,
    id: "test",
    updatedAt: new Date().toISOString(),
    details: demoDetails,
    documents: [
      {
        id: "doc",
        name: "sample.txt",
        kind: "plan",
        mime: "text/plain",
        size: 5,
        blob: new Blob(["hello"]),
        text: "hello",
        status: "ready",
      },
    ],
    reviewed: true,
    coverageVerified: false,
  };
  await saveProfile(profile);
  const loaded = await loadProfile();
  expect(loaded?.details.memberId).toBe("DEMO123456");
  expect(await loaded?.documents[0].blob.text()).toBe("hello");
  await saveProfile({
    ...profile,
    details: { ...demoDetails, insurer: "Changed" },
  });
  expect((await loadProfile())?.details.insurer).toBe("Changed");
  await deleteProfile();
  expect(await loadProfile()).toBeUndefined();
});
