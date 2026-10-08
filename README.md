# Hand Cricket Championship Live

You are an Elite Senior React & WebSockets Game Architect. Your directive is to build the complete, production-ready, real-time multiplayer web app for "The Hand Cricket Championship (HCC) - Pure Match Engine" IN A SINGLE SHOT. 

### [CRITICAL EXECUTION CONSTRAINTS]

1. NO QUESTIONS, NO PHASES: Do not ask me if I want Supabase integration. Do not ask me how to proceed. Use standard React, Tailwind CSS, and a real-time WebSocket layer (like PartyKit or Socket.io) for instant peer-to-peer connection via a universal link. Build the entire application now.

2. ZERO TRUNCATION: Write every file, component, and logic gate fully. Do not use placeholders like `// rest of code`. 

3. PREVENT RACE CONDITIONS (Commit-Reveal): Both players must lock their numpad inputs. Only when `p1Locked && p2Locked` is true should the match engine calculate the run/wicket, log the ball, and reset the UI. 

4. UI & SCROLLING: Use `min-h-screen flex flex-col`. Make game panels `flex-1 overflow-y-auto`.

5. DISCONNECT CACHING: Match state must be saved to `localStorage` tied to the `roomCode` on every single ball. If a user drops and reconnects within the 5-MINUTE DISCONNECT TIMER, hydrate the state and resume the exact ball seamlessly.

---

### [PART 1: DATA LAYER & SQUADS]

Initialize the game with these exact 10 teams. Each team has exactly 8 players. 

Roles: Batter, WK, Pace AR, Spin AR, Pace Bowler, Spin Bowler. 

Note: The first 5 players listed for every team are the ONLY players eligible to bat. The bottom 3 (pure bowlers) can NEVER bat.

1. TUXI: Phil Salt(Bat), Sanju Samson(WK), MS Dhoni(C)(WK), Jason Holder(Pace AR), Mitchell Santner(Spin AR), Varun Chakravarthy(Spin Bowler), Mohd Shami(Pace Bowler), Kagiso Rabada(Pace Bowler).

2. CJ: Ruturaj Gaikwad(C)(Bat), Ishan Kishan(WK), Shubman Gill(Bat), Akeal Hossein(Spin AR), Jamie Overton(Pace AR), Noor Ahmed(Spin Bowler), Mohammed Siraj(Pace Bowler), Jofra Archer(Pace Bowler).

3. KK: Yashasvi Jaiswal(Bat), Vaibhav Sooryavanshi(Bat), Dhruv Jurel(WK), Sam Curran(Pace AR), R. Jadeja(C)(Spin AR), Anshul Kamboj(Pace Bowler), Sandeep Sharma(Pace Bowler), Ravi Bishnoi(Spin Bowler).

4. SS: Rohit Sharma(C)(Bat), Suryakumar Yadav(VC)(Bat), Quinton de Kock(WK), Rashid Khan(Spin AR), Hardik Pandya(Pace AR), Jasprit Bumrah(Pace Bowler), Trent Boult(Pace Bowler), Suyash Sharma(Spin Bowler).

5. ART: Mitch Marsh(Bat), Josh Inglis(WK), Nicolas Pooran(Bat), Arjun Tendulkar(Pace AR), Axar Patel(C)(Spin AR), Prasidh Krishna(Pace Bowler), Rahul Chahar(Spin Bowler), Prince Yadav(Pace Bowler).

6. KS: Sai Sudharshan(Bat), Ryan Rickelton(WK), Shreyas Iyer(C)(Bat), Marcus Stoinis(Pace AR), Tristan Stubbs(Spin AR), T. Natrajan(Pace Bowler), Yuzvendra Chahal(Spin Bowler), Pat Cummins(Pace Bowler).

7. BW: Virat Kohli(Bat), Rajat Patidar(C)(Bat), Jos Buttler(WK), Romario Shepherd(Pace AR), Krunal Pandya(Spin AR), Bhuvneshwar Kumar(Pace Bowler), Josh Hazlewood(Pace Bowler), Allah Ghazanfar(Spin Bowler).

8. HYB: Finn Allen(VC)(WK), Ajinkya Rahane(C)(Bat), Rinku Singh(Bat), Cameron Green(Pace AR), Rachin Ravindra(Spin AR), Umran Malik(Pace Bowler), Matheesha Pathirana(Pace Bowler), Anukul Roy(Spin Bowler).

9. GSK: Abhishek Sharma(VC)(Bat), Ayush Mhatre(Bat), Heinrich Klaasen(C)(WK), Nitish Kumar Reddy(Pace AR), Kamindu Mendis(Spin AR), Harshal Patel(Pace Bowler), Jacob Duffy(Pace Bowler), Harsh Dubey(Spin Bowler).

10. GIM: Sunil Narine(Spin AR), KL Rahul(C)(WK), David Miller(Bat), Marco Jansen(Pace AR), Ashutosh Sharma(Bat), Mitchell Starc(Pace Bowler), Lungi Ngidi(Pace Bowler), Kuldeep Yadav(Spin Bowler).

---

### [PART 2: MATCH SETUP & STRICT BLOCKING UI]

- Gateway: User selects one of the 10 teams. User A clicks "Create Room" (generates code). User B enters code.

- Toss: Away Team (Joiner) automatically gets to call. Home Team flips 3D coin. Winner selects BAT FIRST or BOWL FIRST.

- The Blocking UI (CRITICAL): Between overs, or when a wicket falls, the game MUST pause. The Bowling team selects the next bowler (cannot be the same bowler from the previous over). The Batting team selects the next batsman. While User A is selecting, User B's screen MUST show a blocking overlay (e.g., "Waiting for Opponent to select batter...") with their numpad entirely disabled to prevent desync deadlocks.

---

### [PART 3: THE GAME ENGINE & CRICKET MATH]

- 4 Innings Test Match Format. Global Match Timer starts at 30:00. Ends in a DRAW at 0:00. 60-second auto-pause if no inputs are detected.

- Tactile 0-10 Numpad. 

- ODD OVERS (Normal Phase): If Bat == Bowl -> OUT. Else -> Score += Bat input.

- EVEN OVERS (Crazy Phase): If Bat == Bowl -> Score += (Bat * Bat). If Bat == Bowl ± 1 -> OUT. (Vice versa applies: 1 is out to 2, 10 is out to 9).

- The Invincible '0' Rule: Batsman inputting '0' scores 0 runs but is COMPLETELY IMMUNE to the Crazy ±1 rule. Max 3 times per over per batsman. If limit is hit, disable the '0' key for that batter. Bowler's '0' key is permanently disabled.

- Strike Rotation: Odd runs swap strike. End of over swaps strike.

---

### [PART 4: WICKETS, LAST MAN STANDING (LMS) & LEADS]

- Batting Limits: Only the top 5 players in a squad can bat. Therefore, an innings has a MAXIMUM of 5 WICKETS.

- Last Man Standing: When the 4th wicket falls, the 5th batter plays alone. Disable ALL strike rotation. They face every ball until the 5th wicket falls (All Out) or they declare.

- Test Cricket Leads/Trails: After Innings 1, the UI must explicitly calculate and display the Trail/Lead. 

  * Lead = (Current Batting Team's Total Runs across their innings) - (Opponent's Total Runs across their innings).

  * Example: Team A scores 150. Team B is batting and is at 100. UI shows: "Team B trails by 50 runs." If Team B reaches 160, UI shows: "Team B leads by 10 runs."

- The Follow-On: Team A can ENFORCE a follow-on against Team B if, after both teams have batted once, Team B's score is less than 50% of Team A's score AND the absolute run deficit is >= 100 runs.

- Tie Condition: A match is a TIE only if the chasing team in the 4th innings is All Out or time expires exactly when their score is 1 run less than the target.

---

### [PART 5: UI VISIBILITY & POST-MATCH SCORECARD]

- In-Match UI: The screen MUST always display the current Over, Ball, Phase (NORMAL/CRAZY), and the individual stats of the current Striker, Non-Striker, and Bowler. Do not leave the players guessing. Include an in-match chatbox. Add a Waddling Duck animation for 0-run dismissals.

- Post-Match Scorecard (Crucial for manual stat tracking):

  Render an exhaustive table for every player, explicitly separating stats into NORMAL Phase and CRAZY Phase.

  * BATSMAN STATS: Runs Scored | Balls Faced | Dots Played | Basic Squares (1, 4, 9, 16) | Low Squares (25, 36, 49) | High Squares (64, 81) | 10 Squares (100).

  * BOWLER STATS: Overs | Maidens (Strictly defined as a Crazy Phase over with 0 squares conceded) | Runs Conceded | Wickets | Economy.

Execute the entire application architecture now.

only issue is in my previous version after toss the website got stuck after choosing players and didnt let me play, please dont let that bug happen here

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hcc-championship.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4fe4c1ed-3440-4097-b97e-aac58908190b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
