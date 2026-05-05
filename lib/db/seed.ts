import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { db } from "./client";
import { jobs } from "./schema";

async function seed() {
  console.log("Seeding Cedar Lane sample job...");

  await db.insert(jobs).values({
    id: "cedar-lane",
    customerName: "Linda Pereira",
    customerPhone: "+1-614-555-0142",
    address: "4127 Cedar Lane, Worthington, OH 43085",
    issueSummary: "Recurring water stain on upstairs bedroom ceiling. Customer reports the stain re-appeared after recent rain. This is the third complaint in 8 months.",
    asset: {
      type: "Residential pitched roof",
      ageYears: 14,
      material: "Asphalt 3-tab shingles",
      notes: "Single-story attached garage; main house is two-story. Bathroom vent and ridge vent on slope facing the affected ceiling.",
    },
    warrantyStatus: "Out of manufacturer warranty (14yr roof, 20yr shingle). Workmanship warranty expired on prior repairs.",
    priorVisits: [
      {
        date: "2025-09-12",
        techName: "Carlos Mendez",
        summary: "Initial leak complaint. Suspected bathroom vent boot.",
        actionsTaken: ["Re-caulked bathroom vent boot collar", "Cleared minor debris from ridge vent"],
      },
      {
        date: "2025-12-04",
        techName: "Carlos Mendez",
        summary: "Customer called back; stain re-appeared after first heavy rain. Found cracked shingles near ridge.",
        actionsTaken: ["Replaced 4 cracked shingles near ridge", "Re-applied roof sealant around vent boot"],
      },
    ],
    technicianNotes: "Homeowner has been patient but is now anxious. Wants to know whether this will recur a fourth time. Considering switching contractors. Roof is approaching end of typical asphalt 3-tab service life.",
    openTasks: [
      "Inspect ridge area for lifted or damaged shingles",
      "Inspect bathroom vent boot for renewed failure",
      "Inspect interior attic side for active moisture",
      "Provide homeowner with go-forward recommendation (repair vs. partial vs. full replacement)",
    ],
    assignedTechName: "Mark Reyes",
    scheduledAt: new Date(),
  }).onConflictDoNothing();

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
