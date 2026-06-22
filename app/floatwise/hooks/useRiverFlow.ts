import { useState, useEffect } from 'react';

// USGS gauge: Yellowstone River near Livingston, MT (Carter's Bridge)
const USGS_SITE = '06192500';
// USGS parameter code 00060 = discharge, cubic feet per second
const DISCHARGE_PARAM = '00060';

export interface RiverFlow {
  cfs: number;
  timestamp: string;
}

interface RiverFlowState {
  flow: RiverFlow | null;
  isLoading: boolean;
  error: string | null;
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
        const url = `https://waterservices.usgs.gov/nwis/iv/?sites=${USGS_SITE}&parameterCd=${DISCHARGE_PARAM}&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`USGS request failed: ${response.status}`);
        }

        const data = await response.json();
        const series = data?.value?.timeSeries?.[0];
        const latest = series?.values?.[0]?.value?.[0];

        if (!latest || latest.value == null) {
          throw new Error('No discharge data available');
        }

        const cfs = Number(latest.value);
        if (Number.isNaN(cfs)) {
          throw new Error('Invalid discharge value');
        }

        if (!cancelled) {
          setState({
            flow: { cfs, timestamp: latest.dateTime },
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
