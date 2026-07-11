import { useState, useEffect } from 'react';

// USGS gauge: Yellowstone River near Livingston, MT (Carter's Bridge)
const USGS_SITE = '06192500';
// USGS parameter code 00060 = discharge, cubic feet per second
const DISCHARGE_PARAM = '00060';
// USGS parameter code 00010 = water temperature, degrees Celsius
const WATER_TEMP_PARAM = '00010';

export interface RiverFlow {
  cfs: number;
  waterTempF: number | null;
  timestamp: string;
}

interface RiverFlowState {
  flow: RiverFlow | null;
  isLoading: boolean;
  error: string | null;
}

interface UsgsTimeSeries {
  variable?: {
    variableCode?: { value?: string }[];
  };
  values?: {
    value?: { value?: string; dateTime?: string }[];
  }[];
}

export function useRiverFlow(): RiverFlowState {
  const [state, setState] = useState<RiverFlowState>({
    flow: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchFlow() {
      try {
        const url = `https://waterservices.usgs.gov/nwis/iv/?sites=${USGS_SITE}&parameterCd=${DISCHARGE_PARAM},${WATER_TEMP_PARAM}&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`USGS request failed: ${response.status}`);
        }

        const data = await response.json();
        const allSeries: UsgsTimeSeries[] = data?.value?.timeSeries ?? [];

        const latestForParam = (paramCode: string) => {
          const series = allSeries.find((s) =>
            s?.variable?.variableCode?.some((code) => code?.value === paramCode)
          );
          return series?.values?.[0]?.value?.[0] ?? null;
        };

        const latestDischarge = latestForParam(DISCHARGE_PARAM);

        if (!latestDischarge || latestDischarge.value == null) {
          throw new Error('No discharge data available');
        }

        const cfs = Number(latestDischarge.value);
        if (Number.isNaN(cfs)) {
          throw new Error('Invalid discharge value');
        }

        // Water temperature is optional — not every gauge reports it year-round
        let waterTempF: number | null = null;
        const latestTemp = latestForParam(WATER_TEMP_PARAM);
        if (latestTemp && latestTemp.value != null) {
          const tempC = Number(latestTemp.value);
          if (!Number.isNaN(tempC)) {
            waterTempF = Math.round((tempC * 9) / 5 + 32);
          }
        }

        if (!cancelled) {
          setState({
            flow: {
              cfs,
              waterTempF,
              timestamp: latestDischarge.dateTime ?? new Date().toISOString(),
            },
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            flow: null,
            isLoading: false,
            error:
              error instanceof Error ? error.message : 'Failed to load river flow',
          });
        }
      }
    }

    fetchFlow();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
