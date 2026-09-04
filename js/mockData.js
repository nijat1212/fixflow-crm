// Initial mock dataset for US Appliance Repair CRM (FixFlow CRM)

export const INITIAL_USERS = [
  {
    id: "user_owner",
    name: "Business Owner",
    email: "owner@fixflow.com",
    role: "owner",
    techId: null
  },
  {
    id: "user_dispatch",
    name: "Sarah (Dispatch)",
    email: "dispatch@fixflow.com",
    role: "dispatcher",
    techId: null
  },
  {
    id: "user_tech1",
    name: "Mike Miller",
    email: "mike@fixflow.com",
    role: "technician",
    techId: "tech_1"
  },
  {
    id: "user_tech2",
    name: "Marcus Vance",
    email: "marcus@fixflow.com",
    role: "technician",
    techId: "tech_2"
  }
];

export const INITIAL_TECHNICIANS = [
  {
    id: "tech_1",
    name: "Mike Miller",
    phone: "(555) 234-5678",
    email: "mike@fixflow.com",
    avatar: "MM",
    color: "#3b82f6", // Blue
    specialties: ["Refrigerator", "Washer", "Dryer"],
    rating: 4.9,
    jobsCompletedThisMonth: 18,
    revenueThisMonth: 4250
  },
  {
    id: "tech_2",
    name: "Marcus Vance",
    phone: "(555) 876-5432",
    email: "marcus@fixflow.com",
    avatar: "MV",
    color: "#10b981", // Emerald
    specialties: ["Oven/Range", "Dishwasher", "Microwave"],
    rating: 4.8,
    jobsCompletedThisMonth: 15,
    revenueThisMonth: 3480
  },
  {
    id: "tech_3",
    name: "David Ross",
    phone: "(555) 432-1098",
    email: "david.r@fixflow.com",
    avatar: "DR",
    color: "#8b5cf6", // Purple
    specialties: ["Washer", "Dryer", "Dishwasher"],
    rating: 4.7,
    jobsCompletedThisMonth: 14,
    revenueThisMonth: 2950
  },
  {
    id: "tech_4",
    name: "Alex Rivera",
    phone: "(555) 678-9012",
    email: "alex.r@fixflow.com",
    avatar: "AR",
    color: "#f59e0b", // Amber
    specialties: ["Microwave", "Dryer", "Garbage Disposal"],
    rating: 4.6,
    jobsCompletedThisMonth: 10,
    revenueThisMonth: 1850
  }
];

export const APPLIANCE_TYPES = [
  "Refrigerator",
  "Washing Machine",
  "Dryer",
  "Dishwasher",
  "Oven / Range",
  "Microwave",
  "Freezer",
  "Garbage Disposal"
];

export const APPLIANCE_BRANDS = [
  "Whirlpool",
  "Samsung",
  "LG",
  "GE Profile",
  "Maytag",
  "Bosch",
  "KitchenAid",
  "Frigidaire",
  "Sub-Zero",
  "Kenmore"
];

export const INITIAL_JOBS = [
  {
    id: "JOB-1001",
    customerName: "Robert Vance",
    phone: "(555) 912-3456",
    address: "1420 Congress Ave, Suite 300",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    applianceType: "Refrigerator",
    brand: "Whirlpool",
    modelNumber: "WRX735SDHZ",
    issueDescription: "Fresh food section warm (55°F), freezer works fine. Ice maker leaking water into bin.",
    urgency: "High",
    status: "Accepted",
    assignedTechId: "tech_1",
    scheduledDate: "2026-09-02",
    scheduledTimeWindow: "8:00 AM - 11:00 AM",
    laborCost: 0,
    partsCost: 0,
    partsUsed: [],
    notes: "Customer mentioned dog is friendly. Key under door mat if running late.",
    createdAt: "2026-09-01T08:30:00Z"
  },
  {
    id: "JOB-1002",
    customerName: "Emily Watson",
    phone: "(555) 789-0123",
    address: "742 Evergreen Terrace",
    city: "Austin",
    state: "TX",
    zipCode: "78704",
    applianceType: "Washing Machine",
    brand: "Samsung",
    modelNumber: "WF45R6100AC",
    issueDescription: "Loud banging during spin cycle, displays error code UE (Unbalanced Error).",
    urgency: "Medium",
    status: "In Route",
    assignedTechId: "tech_2",
    scheduledDate: "2026-09-02",
    scheduledTimeWindow: "11:00 AM - 2:00 PM",
    laborCost: 0,
    partsCost: 0,
    partsUsed: [],
    notes: "Call 15 minutes before arrival.",
    createdAt: "2026-09-01T09:15:00Z"
  },
  {
    id: "JOB-1003",
    customerName: "Marcus Sterling",
    phone: "(555) 345-6789",
    address: "3100 South Congress Ave",
    city: "Austin",
    state: "TX",
    zipCode: "78704",
    applianceType: "Dryer",
    brand: "LG",
    modelNumber: "DLE7300WE",
    issueDescription: "Dryer runs but produces no heat. Clothes remain damp after 2 full cycles.",
    urgency: "Urgent",
    status: "On Site",
    assignedTechId: "tech_1",
    scheduledDate: "2026-09-02",
    scheduledTimeWindow: "2:00 PM - 5:00 PM",
    laborCost: 0,
    partsCost: 0,
    partsUsed: [],
    notes: "Gate code #4921.",
    createdAt: "2026-09-01T10:00:00Z"
  },
  {
    id: "JOB-1004",
    customerName: "Linda Gomez",
    phone: "(555) 654-3210",
    address: "8804 Burnet Rd",
    city: "Austin",
    state: "TX",
    zipCode: "78757",
    applianceType: "Dishwasher",
    brand: "Bosch",
    modelNumber: "SHXM63W55N",
    issueDescription: "Error code E15 on display, drain pump running continuously even when powered off.",
    urgency: "Medium",
    status: "Waiting for Parts",
    assignedTechId: "tech_3",
    scheduledDate: "2026-09-01",
    scheduledTimeWindow: "9:00 AM - 12:00 PM",
    laborCost: 140,
    partsCost: 85,
    partsUsed: ["Base Basin Safety Switch Assembly (00611311)"],
    notes: "Part ordered from distributor, ETA Sept 3.",
    createdAt: "2026-08-31T14:20:00Z"
  },
  {
    id: "JOB-1005",
    customerName: "Jonathan Hayes",
    phone: "(555) 456-7890",
    address: "1205 Lamar Blvd",
    city: "Austin",
    state: "TX",
    zipCode: "78703",
    applianceType: "Oven / Range",
    brand: "GE Profile",
    modelNumber: "PGS930YPFS",
    issueDescription: "Front left gas burner igniter clicks constantly even when turned off.",
    urgency: "Low",
    status: "Completed",
    assignedTechId: "tech_2",
    scheduledDate: "2026-09-01",
    scheduledTimeWindow: "1:00 PM - 4:00 PM",
    laborCost: 165,
    partsCost: 45,
    partsUsed: ["Spark Switch Harness Assembly"],
    notes: "Cleaned burner valve moisture and replaced faulty harness switch.",
    createdAt: "2026-08-31T11:00:00Z"
  },
  {
    id: "JOB-1006",
    customerName: "Amanda Clark",
    phone: "(555) 890-1234",
    address: "501 East 5th St",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    applianceType: "Microwave",
    brand: "KitchenAid",
    modelNumber: "KMHC319ESS",
    issueDescription: "Sparks inside microwave cabinet when heating liquids. Mica wave guide cover burned.",
    urgency: "Medium",
    status: "Available",
    assignedTechId: null,
    scheduledDate: "2026-09-03",
    scheduledTimeWindow: "8:00 AM - 11:00 AM",
    laborCost: 0,
    partsCost: 0,
    partsUsed: [],
    notes: "Downtown condo with valet parking.",
    createdAt: "2026-09-01T15:45:00Z"
  },
  {
    id: "JOB-1007",
    customerName: "David Thornton",
    phone: "(555) 234-9876",
    address: "2400 Guadalupe St",
    city: "Austin",
    state: "TX",
    zipCode: "78705",
    applianceType: "Washing Machine",
    brand: "Maytag",
    modelNumber: "MVW6200KW",
    issueDescription: "Machine won't drain water after wash cycle. Tub filled to top.",
    urgency: "Urgent",
    status: "Available",
    assignedTechId: null,
    scheduledDate: "2026-09-02",
    scheduledTimeWindow: "1:00 PM - 4:00 PM",
    laborCost: 0,
    partsCost: 0,
    partsUsed: [],
    notes: "Student housing unit.",
    createdAt: "2026-09-01T16:20:00Z"
  },
  {
    id: "JOB-1008",
    customerName: "Patricia Bennett",
    phone: "(555) 321-7654",
    address: "4105 Medical Pkwy",
    city: "Austin",
    state: "TX",
    zipCode: "78756",
    applianceType: "Refrigerator",
    brand: "Whirlpool",
    modelNumber: "WRF535SWHZ",
    issueDescription: "Compressor clicking on and off every 30 seconds. Freezer warming up rapidly.",
    urgency: "Urgent",
    status: "Completed",
    assignedTechId: "tech_1",
    scheduledDate: "2026-08-30",
    scheduledTimeWindow: "10:00 AM - 1:00 PM",
    laborCost: 190,
    partsCost: 110,
    partsUsed: ["Start Relay & Overload Capacitor Kit"],
    notes: "Replaced faulty start relay. Unit pull down temperature tested OK.",
    createdAt: "2026-08-30T07:45:00Z"
  },
  {
    id: "JOB-1009",
    customerName: "Christopher Evans",
    phone: "(555) 567-8901",
    address: "1600 Barton Springs Rd",
    city: "Austin",
    state: "TX",
    zipCode: "78704",
    applianceType: "Oven / Range",
    brand: "Frigidaire",
    modelNumber: "FFEF3054TS",
    issueDescription: "Bake element non-responsive. Broil element functions properly.",
    urgency: "Low",
    status: "Completed",
    assignedTechId: "tech_3",
    scheduledDate: "2026-08-29",
    scheduledTimeWindow: "2:00 PM - 5:00 PM",
    laborCost: 135,
    partsCost: 75,
    partsUsed: ["Lower Bake Heating Element"],
    notes: "Replaced element and verified thermal sensor readings.",
    createdAt: "2026-08-29T12:10:00Z"
  }
];

export function generateSeedShifts() {
  const shifts = [];
  const techIds = ["tech_1", "tech_2", "tech_3", "tech_4"];

  for (let day = 1; day <= 30; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-09-${dayStr}`;
    const dateObj = new Date(2026, 8, day);
    const dayOfWeek = dateObj.getDay();

    techIds.forEach((techId, idx) => {
      let shift = "Morning (8am-4pm)";
      if (dayOfWeek === 0) {
        shift = "Off";
      } else if (dayOfWeek === 6) {
        shift = (idx % 2 === 0) ? "Morning (8am-4pm)" : "Off";
      } else {
        if ((day + idx) % 5 === 0) shift = "Off";
        else if ((day + idx) % 3 === 0) shift = "Evening (12pm-8pm)";
        else if ((day + idx) % 4 === 0) shift = "Full Day (8am-6pm)";
      }

      shifts.push({
        id: `shift_${techId}_${dateStr}`,
        techId: techId,
        date: dateStr,
        shiftType: shift
      });
    });
  }

  return shifts;
}
