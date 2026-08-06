export type UserRole = 'driver' | 'shipper';

export type EquipmentType =
  | 'sprinter_van'
  | 'box_16'
  | 'box_24'
  | 'box_26'
  | 'box_26_liftgate';

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  sprinter_van: 'Sprinter Van',
  box_16: 'Box Truck 16 ft',
  box_24: 'Box Truck 24 ft',
  box_26: 'Box Truck 26 ft',
  box_26_liftgate: 'Box Truck 26 ft + Liftgate',
};

export const EQUIPMENT_ORDER: EquipmentType[] = [
  'sprinter_van',
  'box_16',
  'box_24',
  'box_26',
  'box_26_liftgate',
];

export const STAGES = [
  'Posted',
  'Booked',
  'En Route to Pickup',
  'Picked Up',
  'In Transit',
  'Approaching',
  'Delivered',
] as const;

/** Button copy for the driver's next action at each stage. */
export const ADVANCE_LABELS: Record<number, string> = {
  1: 'Start trip — en route to pickup',
  2: 'Confirm pickup (BOL uploaded)',
  3: 'Mark in transit',
  4: 'Mark approaching destination',
  5: 'Mark delivered',
};

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  company: string;
  mc_number: string | null;
  equipment: EquipmentType | null;
  home_zip: string | null;
  is_premium: boolean;
};

/** A row of public.v_loads. */
export type Load = {
  id: string;
  ref: string;
  stage: number;
  miles: number;
  rate: number;
  rate_per_mile: number;
  commodity: string;
  weight_lb: number;
  pieces: number;
  len_in: number;
  wid_in: number;
  hgt_in: number;
  cube_ft: number;
  equipment: EquipmentType;
  pickup_at: string | null;
  deliver_by: string | null;
  eta: string | null;
  miles_remaining: number | null;
  booked_at: string | null;
  delivered_at: string | null;
  created_at: string;
  shipper_id: string;
  carrier_id: string | null;
  broker_id: string | null;
  origin_zip: string;
  origin_city: string;
  origin_state: string;
  origin_lat: number;
  origin_lng: number;
  dest_zip: string;
  dest_city: string;
  dest_state: string;
  dest_lat: number;
  dest_lng: number;
  broker_company: string | null;
  broker_rep: string | null;
  shipper_company: string | null;
  driver_name: string | null;
  carrier_company: string | null;
};

/** A row of public.v_brokers — reliability fields are null without Premium. */
export type Broker = {
  id: string;
  company: string;
  rep_name: string;
  reliability_score: number | null;
  on_time_pct: number | null;
  avg_days_to_pay: number | null;
  dispute_pct: number | null;
  loads_posted: number | null;
  member_since: number | null;
  payment_terms: string | null;
  unlocked: boolean;
};

export type Message = {
  id: number;
  owner_id: string;
  body: string;
  from_dispatch: boolean;
  created_at: string;
};

export type LoadEvent = {
  id: number;
  load_id: string;
  stage: number | null;
  note: string;
  created_at: string;
};

export type Place = { zip: string; city: string; state: string };

export type LoadFilters = {
  from: string;
  to: string;
  maxDeadhead: string;
  equipment: string;
  minRpm: string;
  trip: string;
};

export type SortKey = 'rpm' | 'rate' | 'deadhead' | 'newest';

export const EMPTY_FILTERS: LoadFilters = {
  from: '',
  to: '',
  maxDeadhead: '',
  equipment: '',
  minRpm: '',
  trip: '',
};
