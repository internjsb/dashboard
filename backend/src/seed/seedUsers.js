// Run with: npm run seed
// Creates the admin + user sample accounts, sets each one's custom claim
// role, and mirrors it into Realtime Database.
import { auth, rtdb } from "../firebaseAdmin.js";
import { sampleUsers } from "../data/sampleData.js";

async function seed() {
  for (const u of sampleUsers) {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(u.email);
      console.log(`Found existing user ${u.email}`);
    } catch {
      userRecord = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      console.log(`Created user ${u.email}`);
    }

    await auth.setCustomUserClaims(userRecord.uid, { role: u.role });
    await rtdb.ref(`users/${userRecord.uid}`).set({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
    });
    console.log(`  -> role set to "${u.role}"`);
  }

  console.log("\nDone. Sample logins:");
  sampleUsers.forEach((u) => console.log(`  ${u.email} / ${u.password}  [${u.role}]`));
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
