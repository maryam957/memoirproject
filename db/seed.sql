-- =====================================================================
-- The Memoir Project — seed data
--
-- The curated prompt library. Contributors never face a blank page, so the
-- library has to exist before the first memoir does.
--
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- Idempotent: safe to run repeatedly.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
insert into prompt_categories (kind, name) values
  ('life_stage',   'Childhood'),
  ('life_stage',   'Growing up'),
  ('life_stage',   'Early adulthood'),
  ('life_stage',   'Working life'),
  ('life_stage',   'Later years'),
  ('theme',        'Everyday life'),
  ('theme',        'Food and home'),
  ('theme',        'Humour'),
  ('theme',        'Hardship'),
  ('theme',        'Craft and work'),
  ('theme',        'Places'),
  ('theme',        'Belief and ritual'),
  ('relationship', 'Parent'),
  ('relationship', 'Grandparent'),
  ('relationship', 'Sibling'),
  ('relationship', 'Partner'),
  ('relationship', 'Friend'),
  ('relationship', 'Colleague')
on conflict (kind, name) do nothing;

-- ---------------------------------------------------------------------
-- Prompts — addressed to the contributor, about the subject
-- ---------------------------------------------------------------------
insert into prompts (question_text, sort_order, is_active)
select v.question_text, v.sort_order, true
from (values
  ('What is the first thing you picture when you think of them?',                 10),
  ('Where were you the first time you met them?',                                 20),
  ('Describe a room they spent a lot of time in.',                                30),
  ('What did they cook, and who did they cook it for?',                           40),
  ('What was the sound of the house when they were in it?',                       50),
  ('Tell me about something they made with their hands.',                         60),
  ('What did they do for work, and how did they talk about it?',                  70),
  ('What story did they tell more than once?',                                    80),
  ('What made them laugh until they could not speak?',                            90),
  ('What did they worry about?',                                                 100),
  ('Tell me about a time they were braver than you expected.',                   110),
  ('What did they believe that you did not?',                                    120),
  ('What did a holiday look like with them?',                                    130),
  ('What were they like as a child, as far as you know?',                        140),
  ('What did they want to be before life decided otherwise?',                    150),
  ('How did they meet the person they spent their life with?',                   160),
  ('What advice did they give that you ignored at the time?',                    170),
  ('What did they teach you without meaning to?',                                180),
  ('What were they like when nobody else was watching?',                         190),
  ('What did they carry with them everywhere?',                                  200),
  ('Describe their handwriting, their voice, or the way they walked.',           210),
  ('What argument did the two of you keep having?',                              220),
  ('When did you last see them, and what do you remember of it?',                230),
  ('What do you wish you had asked them?',                                       240),
  ('What would surprise their grandchildren about them?',                        250),
  ('Tell me about a journey you took together.',                                 260),
  ('What did they keep that had no value to anyone else?',                       270),
  ('What were they like at work, according to the people there?',                280),
  ('Who did they look after, quietly?',                                          290),
  ('If you could keep one photograph of them, which one would it be, and why?',  300)
) as v (question_text, sort_order)
where not exists (
  select 1 from prompts p where p.question_text = v.question_text
);

-- ---------------------------------------------------------------------
-- Classification — a prompt may sit in several categories
-- ---------------------------------------------------------------------
insert into prompt_category_assignments (prompt_id, category_id)
select p.id, c.id
from (values
  ('What is the first thing you picture when you think of them?',                'theme',        'Everyday life'),
  ('Where were you the first time you met them?',                                'theme',        'Places'),
  ('Describe a room they spent a lot of time in.',                               'theme',        'Food and home'),
  ('Describe a room they spent a lot of time in.',                               'theme',        'Places'),
  ('What did they cook, and who did they cook it for?',                          'theme',        'Food and home'),
  ('What was the sound of the house when they were in it?',                      'theme',        'Everyday life'),
  ('Tell me about something they made with their hands.',                        'theme',        'Craft and work'),
  ('What did they do for work, and how did they talk about it?',                 'theme',        'Craft and work'),
  ('What did they do for work, and how did they talk about it?',                 'life_stage',   'Working life'),
  ('What story did they tell more than once?',                                   'theme',        'Humour'),
  ('What made them laugh until they could not speak?',                           'theme',        'Humour'),
  ('What did they worry about?',                                                 'theme',        'Hardship'),
  ('Tell me about a time they were braver than you expected.',                   'theme',        'Hardship'),
  ('What did they believe that you did not?',                                    'theme',        'Belief and ritual'),
  ('What did a holiday look like with them?',                                    'theme',        'Belief and ritual'),
  ('What were they like as a child, as far as you know?',                        'life_stage',   'Childhood'),
  ('What did they want to be before life decided otherwise?',                    'life_stage',   'Early adulthood'),
  ('How did they meet the person they spent their life with?',                   'life_stage',   'Early adulthood'),
  ('How did they meet the person they spent their life with?',                   'relationship', 'Partner'),
  ('What advice did they give that you ignored at the time?',                    'relationship', 'Parent'),
  ('What did they teach you without meaning to?',                                'relationship', 'Parent'),
  ('What did they teach you without meaning to?',                                'relationship', 'Grandparent'),
  ('What were they like when nobody else was watching?',                         'theme',        'Everyday life'),
  ('What did they carry with them everywhere?',                                  'theme',        'Everyday life'),
  ('Describe their handwriting, their voice, or the way they walked.',           'theme',        'Everyday life'),
  ('What argument did the two of you keep having?',                              'relationship', 'Sibling'),
  ('When did you last see them, and what do you remember of it?',                'life_stage',   'Later years'),
  ('What do you wish you had asked them?',                                       'life_stage',   'Later years'),
  ('What would surprise their grandchildren about them?',                        'relationship', 'Grandparent'),
  ('Tell me about a journey you took together.',                                 'theme',        'Places'),
  ('What did they keep that had no value to anyone else?',                       'theme',        'Everyday life'),
  ('What were they like at work, according to the people there?',                'relationship', 'Colleague'),
  ('What were they like at work, according to the people there?',                'life_stage',   'Working life'),
  ('Who did they look after, quietly?',                                          'relationship', 'Friend'),
  ('If you could keep one photograph of them, which one would it be, and why?',  'theme',        'Everyday life')
) as v (question_text, kind, name)
join prompts p           on p.question_text = v.question_text
join prompt_categories c on c.kind = v.kind::prompt_category_kind and c.name = v.name
on conflict (prompt_id, category_id) do nothing;

commit;
