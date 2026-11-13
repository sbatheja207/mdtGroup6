import { openDB } from "idb";
import type { PlanProfile } from "./plan";
const database = () =>
  openDB("clearcover-demo", 1, {
    upgrade(db) {
      db.createObjectStore("profiles");
    },
  });
export async function loadProfile(): Promise<PlanProfile | undefined> {
  const db = await database();
  try {
    return await db.get("profiles", "current");
  } finally {
    db.close();
  }
}
export async function saveProfile(profile: PlanProfile) {
  const db = await database();
  try {
    await db.put("profiles", profile, "current");
  } finally {
    db.close();
  }
}
export async function deleteProfile() {
  const db = await database();
  try {
    await db.delete("profiles", "current");
  } finally {
    db.close();
  }
}
