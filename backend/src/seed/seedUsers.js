// Run with: npm run seed
// Creates the admin + user sample accounts if they don't exist yet, and makes
// sure each one has the right role claim + an "active" RTDB record.
//
// SAFE TO RE-RUN: for accounts that already exist it only touches role/status.
// It will NOT overwrite a display name or password you've since changed.
import { auth, rtdb } from "../firebaseAdmin.js";
import { sampleUsers } from "../data/sampleData.js";

async function seed() {
  for (const u of sampleUsers) {
    let userRecord;
    let isNew = false;

    try {
      userRecord = await auth.getUserByEmail(u.email);
      console.log(`Found existing user ${u.email} — leaving name/password as-is`);
    } catch {
      userRecord = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      isNew = true;
      console.log(`Created user ${u.email}`);
    }

    await auth.setCustomUserClaims(userRecord.uid, { role: u.role });

    const ref = rtdb.ref(`users/${userRecord.uid}`);
    if (isNew || !(await ref.get()).exists()) {
      // Fresh record — write the whole thing.
      await ref.set({
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        status: "active",
      });
    } else {
      // Existing record — only enforce role + status, keep the rest.
      await ref.update({ role: u.role, status: "active" });
    }

    console.log(`  -> role "${u.role}", status "active"`);
  }

  console.log("\nDone. Sample logins:");
  sampleUsers.forEach((u) => console.log(`  ${u.email} / ${u.password}  [${u.role}]`));
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
