CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE (user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.hcc_teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text,
  accent text,
  season text NOT NULL DEFAULT 'S1',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hcc_teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hcc_teams TO authenticated;
GRANT ALL ON public.hcc_teams TO service_role;
ALTER TABLE public.hcc_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are public" ON public.hcc_teams FOR SELECT USING (true);
CREATE POLICY "Admins manage teams" ON public.hcc_teams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER hcc_teams_updated BEFORE UPDATE ON public.hcc_teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hcc_players (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('Bat','WK','AR','Pace AR','Spin AR','Bowler','Pace Bowler','Spin Bowler')),
  team_id text REFERENCES public.hcc_teams(id) ON UPDATE CASCADE ON DELETE SET NULL,
  squad_order int NOT NULL DEFAULT 0,
  is_captain boolean NOT NULL DEFAULT false,
  is_vice_captain boolean NOT NULL DEFAULT false,
  base_ovr numeric,
  current_ovr numeric,
  confidence numeric,
  risk numeric,
  fielding numeric,
  captaincy numeric,
  home_venue text,
  ratings_are_placeholder boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hcc_players TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hcc_players TO authenticated;
GRANT ALL ON public.hcc_players TO service_role;
ALTER TABLE public.hcc_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are public" ON public.hcc_players FOR SELECT USING (true);
CREATE POLICY "Admins manage players" ON public.hcc_players FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER hcc_players_updated BEFORE UPDATE ON public.hcc_players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.hcc_teams (id,name,color,accent,season,sort_order) VALUES
('TUXI','TUXI','#1a1a1a','#d4af37','S1',0),
('CJ','CJ','#fbbf24','#1e3a8a','S1',1),
('KK','KK','#ec4899','#7c2d12','S1',2),
('SS','SS','#0ea5e9','#fde047','S1',3),
('ART','ART','#dc2626','#fbbf24','S1',4),
('KS','KS','#7c3aed','#f97316','S1',5),
('BW','BW','#b91c1c','#000000','S1',6),
('HYB','HYB','#059669','#fef08a','S1',7),
('GSK','GSK','#f59e0b','#000000','S1',8),
('GIM','GIM','#0891b2','#facc15','S1',9);
INSERT INTO public.hcc_players (id,name,role,team_id,squad_order,is_captain,is_vice_captain) VALUES
('TUXI-phil-salt','Phil Salt','Bat','TUXI',0,false,false),
('TUXI-sanju-samson','Sanju Samson','WK','TUXI',1,false,false),
('TUXI-ms-dhoni','MS Dhoni','WK','TUXI',2,true,false),
('TUXI-jason-holder','Jason Holder','Pace AR','TUXI',3,false,false),
('TUXI-mitchell-santner','Mitchell Santner','Spin AR','TUXI',4,false,false),
('TUXI-varun-chakravarthy','Varun Chakravarthy','Spin Bowler','TUXI',5,false,false),
('TUXI-mohd-shami','Mohd Shami','Pace Bowler','TUXI',6,false,false),
('TUXI-kagiso-rabada','Kagiso Rabada','Pace Bowler','TUXI',7,false,false),
('CJ-ruturaj-gaikwad','Ruturaj Gaikwad','Bat','CJ',0,true,false),
('CJ-ishan-kishan','Ishan Kishan','WK','CJ',1,false,false),
('CJ-shubman-gill','Shubman Gill','Bat','CJ',2,false,false),
('CJ-akeal-hossein','Akeal Hossein','Spin AR','CJ',3,false,false),
('CJ-jamie-overton','Jamie Overton','Pace AR','CJ',4,false,false),
('CJ-noor-ahmed','Noor Ahmed','Spin Bowler','CJ',5,false,false),
('CJ-mohammed-siraj','Mohammed Siraj','Pace Bowler','CJ',6,false,false),
('CJ-jofra-archer','Jofra Archer','Pace Bowler','CJ',7,false,false),
('KK-yashasvi-jaiswal','Yashasvi Jaiswal','Bat','KK',0,false,false),
('KK-vaibhav-sooryavanshi','Vaibhav Sooryavanshi','Bat','KK',1,false,false),
('KK-dhruv-jurel','Dhruv Jurel','WK','KK',2,false,false),
('KK-sam-curran','Sam Curran','Pace AR','KK',3,false,false),
('KK-r-jadeja','R. Jadeja','Spin AR','KK',4,true,false),
('KK-anshul-kamboj','Anshul Kamboj','Pace Bowler','KK',5,false,false),
('KK-sandeep-sharma','Sandeep Sharma','Pace Bowler','KK',6,false,false),
('KK-ravi-bishnoi','Ravi Bishnoi','Spin Bowler','KK',7,false,false),
('SS-rohit-sharma','Rohit Sharma','Bat','SS',0,true,false),
('SS-suryakumar-yadav','Suryakumar Yadav','Bat','SS',1,false,true),
('SS-quinton-de-kock','Quinton de Kock','WK','SS',2,false,false),
('SS-rashid-khan','Rashid Khan','Spin AR','SS',3,false,false),
('SS-hardik-pandya','Hardik Pandya','Pace AR','SS',4,false,false),
('SS-jasprit-bumrah','Jasprit Bumrah','Pace Bowler','SS',5,false,false),
('SS-trent-boult','Trent Boult','Pace Bowler','SS',6,false,false),
('SS-suyash-sharma','Suyash Sharma','Spin Bowler','SS',7,false,false),
('ART-mitch-marsh','Mitch Marsh','Bat','ART',0,false,false),
('ART-josh-inglis','Josh Inglis','WK','ART',1,false,false),
('ART-nicolas-pooran','Nicolas Pooran','Bat','ART',2,false,false),
('ART-arjun-tendulkar','Arjun Tendulkar','Pace AR','ART',3,false,false),
('ART-axar-patel','Axar Patel','Spin AR','ART',4,true,false),
('ART-prasidh-krishna','Prasidh Krishna','Pace Bowler','ART',5,false,false),
('ART-rahul-chahar','Rahul Chahar','Spin Bowler','ART',6,false,false),
('ART-prince-yadav','Prince Yadav','Pace Bowler','ART',7,false,false),
('KS-sai-sudharshan','Sai Sudharshan','Bat','KS',0,false,false),
('KS-ryan-rickelton','Ryan Rickelton','WK','KS',1,false,false),
('KS-shreyas-iyer','Shreyas Iyer','Bat','KS',2,true,false),
('KS-marcus-stoinis','Marcus Stoinis','Pace AR','KS',3,false,false),
('KS-tristan-stubbs','Tristan Stubbs','Spin AR','KS',4,false,false),
('KS-t-natrajan','T. Natrajan','Pace Bowler','KS',5,false,false),
('KS-yuzvendra-chahal','Yuzvendra Chahal','Spin Bowler','KS',6,false,false),
('KS-pat-cummins','Pat Cummins','Pace Bowler','KS',7,false,false),
('BW-virat-kohli','Virat Kohli','Bat','BW',0,false,false),
('BW-rajat-patidar','Rajat Patidar','Bat','BW',1,true,false),
('BW-jos-buttler','Jos Buttler','WK','BW',2,false,false),
('BW-romario-shepherd','Romario Shepherd','Pace AR','BW',3,false,false),
('BW-krunal-pandya','Krunal Pandya','Spin AR','BW',4,false,false),
('BW-bhuvneshwar-kumar','Bhuvneshwar Kumar','Pace Bowler','BW',5,false,false),
('BW-josh-hazlewood','Josh Hazlewood','Pace Bowler','BW',6,false,false),
('BW-allah-ghazanfar','Allah Ghazanfar','Spin Bowler','BW',7,false,false),
('HYB-finn-allen','Finn Allen','WK','HYB',0,false,true),
('HYB-ajinkya-rahane','Ajinkya Rahane','Bat','HYB',1,true,false),
('HYB-rinku-singh','Rinku Singh','Bat','HYB',2,false,false),
('HYB-cameron-green','Cameron Green','Pace AR','HYB',3,false,false),
('HYB-rachin-ravindra','Rachin Ravindra','Spin AR','HYB',4,false,false),
('HYB-umran-malik','Umran Malik','Pace Bowler','HYB',5,false,false),
('HYB-matheesha-pathirana','Matheesha Pathirana','Pace Bowler','HYB',6,false,false),
('HYB-anukul-roy','Anukul Roy','Spin Bowler','HYB',7,false,false),
('GSK-abhishek-sharma','Abhishek Sharma','Bat','GSK',0,false,true),
('GSK-ayush-mhatre','Ayush Mhatre','Bat','GSK',1,false,false),
('GSK-heinrich-klaasen','Heinrich Klaasen','WK','GSK',2,true,false),
('GSK-nitish-kumar-reddy','Nitish Kumar Reddy','Pace AR','GSK',3,false,false),
('GSK-kamindu-mendis','Kamindu Mendis','Spin AR','GSK',4,false,false),
('GSK-harshal-patel','Harshal Patel','Pace Bowler','GSK',5,false,false),
('GSK-jacob-duffy','Jacob Duffy','Pace Bowler','GSK',6,false,false),
('GSK-harsh-dubey','Harsh Dubey','Spin Bowler','GSK',7,false,false),
('GIM-sunil-narine','Sunil Narine','Spin AR','GIM',0,false,false),
('GIM-kl-rahul','KL Rahul','WK','GIM',1,true,false),
('GIM-david-miller','David Miller','Bat','GIM',2,false,false),
('GIM-marco-jansen','Marco Jansen','Pace AR','GIM',3,false,false),
('GIM-ashutosh-sharma','Ashutosh Sharma','Bat','GIM',4,false,false),
('GIM-mitchell-starc','Mitchell Starc','Pace Bowler','GIM',5,false,false),
('GIM-lungi-ngidi','Lungi Ngidi','Pace Bowler','GIM',6,false,false),
('GIM-kuldeep-yadav','Kuldeep Yadav','Spin Bowler','GIM',7,false,false);