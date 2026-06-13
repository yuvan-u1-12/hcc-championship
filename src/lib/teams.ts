// HCC squads. First 5 players in each squad are the ONLY eligible batters.
// Last 3 are pure bowlers and can NEVER bat.

export type Role = "Bat" | "WK" | "Pace AR" | "Spin AR" | "Pace Bowler" | "Spin Bowler";

export interface Player {
  name: string;
  role: Role;
  captain?: boolean;
  viceCaptain?: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  accent: string;
  players: Player[];
}

export const TEAMS: Team[] = [
  {
    id: "TUXI",
    name: "TUXI",
    color: "#1a1a1a",
    accent: "#d4af37",
    players: [
      { name: "Phil Salt", role: "Bat" },
      { name: "Sanju Samson", role: "WK" },
      { name: "MS Dhoni", role: "WK", captain: true },
      { name: "Jason Holder", role: "Pace AR" },
      { name: "Mitchell Santner", role: "Spin AR" },
      { name: "Varun Chakravarthy", role: "Spin Bowler" },
      { name: "Mohd Shami", role: "Pace Bowler" },
      { name: "Kagiso Rabada", role: "Pace Bowler" },
    ],
  },
  {
    id: "CJ",
    name: "CJ",
    color: "#fbbf24",
    accent: "#1e3a8a",
    players: [
      { name: "Ruturaj Gaikwad", role: "Bat", captain: true },
      { name: "Ishan Kishan", role: "WK" },
      { name: "Shubman Gill", role: "Bat" },
      { name: "Akeal Hossein", role: "Spin AR" },
      { name: "Jamie Overton", role: "Pace AR" },
      { name: "Noor Ahmed", role: "Spin Bowler" },
      { name: "Mohammed Siraj", role: "Pace Bowler" },
      { name: "Jofra Archer", role: "Pace Bowler" },
    ],
  },
  {
    id: "KK",
    name: "KK",
    color: "#ec4899",
    accent: "#7c2d12",
    players: [
      { name: "Yashasvi Jaiswal", role: "Bat" },
      { name: "Vaibhav Sooryavanshi", role: "Bat" },
      { name: "Dhruv Jurel", role: "WK" },
      { name: "Sam Curran", role: "Pace AR" },
      { name: "R. Jadeja", role: "Spin AR", captain: true },
      { name: "Anshul Kamboj", role: "Pace Bowler" },
      { name: "Sandeep Sharma", role: "Pace Bowler" },
      { name: "Ravi Bishnoi", role: "Spin Bowler" },
    ],
  },
  {
    id: "SS",
    name: "SS",
    color: "#0ea5e9",
    accent: "#fde047",
    players: [
      { name: "Rohit Sharma", role: "Bat", captain: true },
      { name: "Suryakumar Yadav", role: "Bat", viceCaptain: true },
      { name: "Quinton de Kock", role: "WK" },
      { name: "Rashid Khan", role: "Spin AR" },
      { name: "Hardik Pandya", role: "Pace AR" },
      { name: "Jasprit Bumrah", role: "Pace Bowler" },
      { name: "Trent Boult", role: "Pace Bowler" },
      { name: "Suyash Sharma", role: "Spin Bowler" },
    ],
  },
  {
    id: "ART",
    name: "ART",
    color: "#dc2626",
    accent: "#fbbf24",
    players: [
      { name: "Mitch Marsh", role: "Bat" },
      { name: "Josh Inglis", role: "WK" },
      { name: "Nicolas Pooran", role: "Bat" },
      { name: "Arjun Tendulkar", role: "Pace AR" },
      { name: "Axar Patel", role: "Spin AR", captain: true },
      { name: "Prasidh Krishna", role: "Pace Bowler" },
      { name: "Rahul Chahar", role: "Spin Bowler" },
      { name: "Prince Yadav", role: "Pace Bowler" },
    ],
  },
  {
    id: "KS",
    name: "KS",
    color: "#7c3aed",
    accent: "#f97316",
    players: [
      { name: "Sai Sudharshan", role: "Bat" },
      { name: "Ryan Rickelton", role: "WK" },
      { name: "Shreyas Iyer", role: "Bat", captain: true },
      { name: "Marcus Stoinis", role: "Pace AR" },
      { name: "Tristan Stubbs", role: "Spin AR" },
      { name: "T. Natrajan", role: "Pace Bowler" },
      { name: "Yuzvendra Chahal", role: "Spin Bowler" },
      { name: "Pat Cummins", role: "Pace Bowler" },
    ],
  },
  {
    id: "BW",
    name: "BW",
    color: "#b91c1c",
    accent: "#000000",
    players: [
      { name: "Virat Kohli", role: "Bat" },
      { name: "Rajat Patidar", role: "Bat", captain: true },
      { name: "Jos Buttler", role: "WK" },
      { name: "Romario Shepherd", role: "Pace AR" },
      { name: "Krunal Pandya", role: "Spin AR" },
      { name: "Bhuvneshwar Kumar", role: "Pace Bowler" },
      { name: "Josh Hazlewood", role: "Pace Bowler" },
      { name: "Allah Ghazanfar", role: "Spin Bowler" },
    ],
  },
  {
    id: "HYB",
    name: "HYB",
    color: "#059669",
    accent: "#fef08a",
    players: [
      { name: "Finn Allen", role: "WK", viceCaptain: true },
      { name: "Ajinkya Rahane", role: "Bat", captain: true },
      { name: "Rinku Singh", role: "Bat" },
      { name: "Cameron Green", role: "Pace AR" },
      { name: "Rachin Ravindra", role: "Spin AR" },
      { name: "Umran Malik", role: "Pace Bowler" },
      { name: "Matheesha Pathirana", role: "Pace Bowler" },
      { name: "Anukul Roy", role: "Spin Bowler" },
    ],
  },
  {
    id: "GSK",
    name: "GSK",
    color: "#f59e0b",
    accent: "#000000",
    players: [
      { name: "Abhishek Sharma", role: "Bat", viceCaptain: true },
      { name: "Ayush Mhatre", role: "Bat" },
      { name: "Heinrich Klaasen", role: "WK", captain: true },
      { name: "Nitish Kumar Reddy", role: "Pace AR" },
      { name: "Kamindu Mendis", role: "Spin AR" },
      { name: "Harshal Patel", role: "Pace Bowler" },
      { name: "Jacob Duffy", role: "Pace Bowler" },
      { name: "Harsh Dubey", role: "Spin Bowler" },
    ],
  },
  {
    id: "GIM",
    name: "GIM",
    color: "#0891b2",
    accent: "#facc15",
    players: [
      { name: "Sunil Narine", role: "Spin AR" },
      { name: "KL Rahul", role: "WK", captain: true },
      { name: "David Miller", role: "Bat" },
      { name: "Marco Jansen", role: "Pace AR" },
      { name: "Ashutosh Sharma", role: "Bat" },
      { name: "Mitchell Starc", role: "Pace Bowler" },
      { name: "Lungi Ngidi", role: "Pace Bowler" },
      { name: "Kuldeep Yadav", role: "Spin Bowler" },
    ],
  },
];

export const getTeam = (id: string): Team | undefined => TEAMS.find((t) => t.id === id);
export const getEligibleBatters = (t: Team): Player[] => t.players.slice(0, 5);
// Only all-rounders and pure bowlers can bowl. Pure batters (Bat) and wicket-keepers (WK) cannot.
export const getEligibleBowlers = (t: Team): Player[] =>
  t.players.filter((p) => p.role !== "Bat" && p.role !== "WK");
