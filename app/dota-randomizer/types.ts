export interface DotaHero {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: string;
  attack_type: string;
  img: string;
  icon: string;
}

export interface DotaItem {
  id: number;
  name: string;
  img: string;
  cost: number;
  components?: string[];
  created?: boolean;
}

export interface WheelItem {
  id: number;
  name: string;
  displayName: string;
  imageUrl: string;
}

export interface SpinState {
  isSpinning: boolean;
  selectedHero: WheelItem | null;
  selectedItem: WheelItem | null;
  showResult: boolean;
}
