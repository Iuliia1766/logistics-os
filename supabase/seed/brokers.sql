-- Broker book. Reliability figures are what the Premium tier unlocks.
insert into public.brokers
  (company, rep_name, reliability_score, on_time_pct, avg_days_to_pay, dispute_pct, loads_posted, member_since, payment_terms)
values
  ('Meridian Freight Group',   'Sarah Whitfield', 94, 97, 21,  1.2, 4180, 2014, 'Quick Pay — 2%'),
  ('Trinity Bay Brokerage',    'Marcus Bell',     96, 98, 15,  0.6, 6320, 2009, 'Quick Pay — 1.5%'),
  ('Southstar Load Partners',  'Priya Raman',     88, 92, 27,  2.8, 2140, 2017, 'Net 30'),
  ('Alamo Transit Group',      'Tom Okafor',      83, 89, 30,  3.5, 1560, 2019, 'Net 30'),
  ('Gulfline Brokerage',       'Jae Lin',         79, 85, 34,  4.1, 1120, 2020, 'Net 30'),
  ('Crosswind Logistics',      'Danny Reyes',     71, 78, 41,  6.4,  890, 2021, 'Net 45'),
  ('HighPlains Freight',       'Elena Vargas',    62, 64, 58, 11.3,  410, 2023, 'Net 60')
on conflict do nothing;
