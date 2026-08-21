import React, { useState, useEffect, useRef } from 'react';
import { ScreenState } from '../types';

export function useScreeningTimers(
  screenState: ScreenState,
  setScreenState: (state: ScreenState) => void,
  isCalibrationOk: boolean = true
) {
  const [prepSeconds, setPrepSeconds] = useState<number>(5);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [screeningSeconds, setScreeningSeconds] = useState<number>(15);

  // Store the latest isCalibrationOk in a ref so the interval can read it without resetting
  const isCalibrationOkRef = React.useRef(isCalibrationOk);
  useEffect(() => {
    isCalibrationOkRef.current = isCalibrationOk;
  }, [isCalibrationOk]);

  useEffect(() => {
    let timerId: number;

    if (screenState === 'PREPARATION') {
      timerId = window.setInterval(() => {
        if (isCalibrationOkRef.current) {
          setPrepSeconds(prev => {
            const next = prev - 1;
            if (next <= 0) {
              setScreenState('COUNTDOWN');
              return 5;
            }
            return next;
          });
        } else {
          // Reset calibration timer to 5s if user moves or leaves the area
          setPrepSeconds(5);
        }
      }, 1000);
    } else if (screenState === 'COUNTDOWN') {
      setCountdownSeconds(3);
      timerId = window.setInterval(() => {
        setCountdownSeconds(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setScreenState('SCREENING');
            setScreeningSeconds(15);
            return 3;
          }
          return next;
        });
      }, 1000);
    } else if (screenState === 'SCREENING') {
      setScreeningSeconds(15);
      timerId = window.setInterval(() => {
        setScreeningSeconds(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setScreenState('FINISHED');
            return 15;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [screenState, setScreenState]);

  return { prepSeconds, countdownSeconds, screeningSeconds };
}
