import type { Procedure } from "./types";

export const PROCEDURES: Procedure[] = [
  {
    id: "office-visit-est",
    displayName: "Office visit (established patient)",
    cptCode: "99213",
    aliases: ["checkup", "primary care", "doctor visit", "sick visit"],
    copayCategory: "primary",
  },
  {
    id: "preventive-physical",
    displayName: "Annual physical / preventive visit",
    cptCode: "99395",
    aliases: ["wellness visit", "physical exam", "annual exam"],
  },
  {
    id: "mri-knee",
    displayName: "MRI of the knee (no contrast)",
    cptCode: "73721",
    aliases: ["knee mri", "mri knee"],
  },
  {
    id: "mri-brain",
    displayName: "MRI of the brain (no contrast)",
    cptCode: "70551",
    aliases: ["brain mri", "head mri"],
  },
  {
    id: "ct-abdomen",
    displayName: "CT of abdomen and pelvis with contrast",
    cptCode: "74177",
    aliases: ["ct scan", "abdominal ct"],
  },
  {
    id: "chest-xray",
    displayName: "Chest X-ray (2 views)",
    cptCode: "71046",
    aliases: ["xray", "x-ray", "chest x ray"],
  },
  {
    id: "mammogram",
    displayName: "Screening mammogram",
    cptCode: "77067",
    aliases: ["mammography", "breast screening"],
  },
  {
    id: "colonoscopy-screening",
    displayName: "Screening colonoscopy",
    cptCode: "45378",
    aliases: ["colonoscopy", "colon screening"],
  },
  {
    id: "ed-moderate",
    displayName: "Emergency department visit (moderate)",
    cptCode: "99284",
    aliases: ["er visit", "ed visit", "emergency room"],
    copayCategory: "emergency",
  },
  {
    id: "cbc",
    displayName: "Complete blood count (CBC)",
    cptCode: "85025",
    aliases: ["blood test", "bloodwork", "lab work"],
  },
  {
    id: "pt-eval",
    displayName: "Physical therapy evaluation",
    cptCode: "97161",
    aliases: ["pt eval", "physio", "physical therapy"],
  },
  {
    id: "skin-biopsy",
    displayName: "Skin biopsy",
    cptCode: "11102",
    aliases: ["biopsy", "dermatology biopsy"],
  },
  {
    id: "knee-arthroscopy",
    displayName: "Knee arthroscopy",
    cptCode: "29881",
    aliases: ["knee surgery", "arthroscopy"],
  },
];
