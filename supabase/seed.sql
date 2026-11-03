-- Sample events (dates are in the future relative to Nov 2026). Run after schema.sql.
-- Safe to edit or delete from the admin page afterwards.
insert into public.events (title, category, starts_at, venue, city, price, seats, featured, short_desc, long_desc) values
('CodeStorm Hackathon 2026','Tech','2026-11-21 09:00+05:30','Tech Park Auditorium','Bhubaneswar',0,150,true,
 '24 hours of building, learning and winning prizes.',
 'Form a team, pick a problem statement and build something amazing in 24 hours. Mentors from top companies, free food, swag and cash prizes for the best three teams.'),
('Sunset Indie Music Night','Music','2026-11-28 18:30+05:30','Open Air Amphitheatre','Cuttack',499,300,true,
 'Live indie bands under the open sky.',
 'Five indie bands, one unforgettable evening. Bring a blanket, grab a snack from the food stalls and enjoy live music as the sun goes down.'),
('Web Dev Bootcamp: React Basics','Workshop','2026-11-15 10:00+05:30','Innovation Lab, Block C','Bhubaneswar',199,60,false,
 'A hands-on one-day workshop for beginners.',
 'Learn components, props, state and hooks by building a small project from scratch. Laptop required. Certificate provided on completion.'),
('Inter-College Football Cup','Sports','2026-12-05 08:00+05:30','Kalinga Stadium Grounds','Bhubaneswar',0,500,false,
 'Cheer for your college in the knockout finals.',
 'Sixteen college teams, one trophy. Come support your team in the knockout stages and enjoy a full day of football, food stalls and fan games.'),
('Odissi & Folk Cultural Fest','Cultural','2026-12-12 17:00+05:30','Rabindra Mandap','Bhubaneswar',150,400,true,
 'A celebration of dance, music and tradition.',
 'Experience classical Odissi, folk performances and handicraft exhibitions by artists from across the state. A beautiful evening of heritage and art.'),
('Startup Pitch Day','Business','2026-12-18 11:00+05:30','Founders Hub','Bhubaneswar',299,120,false,
 'Watch student startups pitch to real investors.',
 'Ten student-led startups pitch their ideas to a panel of investors and founders. Includes a networking lunch and a Q&A with the panel.'),
('AI & Machine Learning Summit','Tech','2027-01-09 09:30+05:30','Convention Centre Hall A','Bhubaneswar',799,250,true,
 'Talks and demos from AI researchers and engineers.',
 'A full-day summit with keynotes, live demos and panel discussions on generative AI, computer vision and responsible AI. Lunch and certificate included.'),
('Photography Walk: Old Town','Workshop','2026-11-22 06:30+05:30','Lingaraj Temple Road','Bhubaneswar',99,40,false,
 'Capture golden-hour stories with a pro mentor.',
 'Walk through the old town at sunrise with a professional photographer. Learn composition, light and street photography. Any camera or phone works.'),
('Marathon for Green Earth','Sports','2027-01-17 05:30+05:30','Marine Drive Start Line','Puri',249,800,false,
 '5K, 10K and 21K runs for a cause.',
 'Run for the planet! Choose your distance, get a finisher medal and T-shirt, and help fund tree plantation drives across the coast.'),
('Stand-up Comedy Laugh Riot','Music','2026-12-26 19:30+05:30','City Club Hall','Bhubaneswar',350,180,false,
 'Top comedians, one night of non-stop laughs.',
 'Four stand-up comedians take the stage for a night of fresh material. Seating is first-come, first-served. Recommended for ages 16+.');

-- After you create your admin login (Authentication -> Users), allow it here:
-- insert into public.admins (email) values ('you@example.com');
